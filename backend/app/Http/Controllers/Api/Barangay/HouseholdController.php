<?php

namespace App\Http\Controllers\Api\Barangay;

use App\Http\Controllers\Controller;
use App\Models\Household;
use App\Services\HouseholdService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Barangay Admin: QR Issuance Review, Household Records, Walk-in Registration.
 * Every query is limited to the admin's own barangay.
 */
class HouseholdController extends Controller
{
    public function __construct(private HouseholdService $service) {}

    public function summary(Request $request)
    {
        $q = fn () => $this->scoped($request);

        return response()->json([
            'barangay' => $request->user()->barangay->name,
            'pending' => $q()->where('status', 'pending')->count(),
            'approved' => $q()->where('status', 'approved')->count(),
            'high_priority' => $q()->where('status', 'approved')->where('priority_level', 'high')->count(),
            'walk_ins_this_month' => $q()->where('registration_type', 'walk_in')
                ->where('created_at', '>=', now()->startOfMonth())->count(),
            'puroks' => $q()->whereNotNull('purok')->distinct()->orderBy('purok')->pluck('purok'),
            'weights' => config('relief.priority_weights'),
            'levels' => config('relief.priority_levels'),
        ]);
    }

    public function index(Request $request)
    {
        $f = $request->validate([
            'status' => ['nullable', 'in:pending,approved,rejected'],
            'priority' => ['nullable', 'in:high,medium,low'],
            'purok' => ['nullable', 'string', 'max:50'],
            'search' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'in:priority,latest'],
        ]);

        $query = $this->scoped($request)
            ->when($f['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($f['priority'] ?? null, fn ($q, $v) => $q->where('priority_level', $v))
            ->when($f['purok'] ?? null, fn ($q, $v) => $q->where('purok', $v))
            ->when($f['search'] ?? null, fn ($q, $s) => $q->where(fn ($w) => $w
                ->where('household_head', 'like', "%$s%")
                ->orWhere('reference_number', 'like', "%$s%")
                ->orWhereHas('members', fn ($m) => $m->where('full_name', 'like', "%$s%"))));

        // Review queue: most vulnerable first, then first-come-first-served
        ($f['sort'] ?? 'latest') === 'priority'
            ? $query->orderByDesc('priority_score')->oldest()
            : $query->latest();

        return $query->paginate(15)->withQueryString();
    }

    public function show(Request $request, Household $household)
    {
        $this->authorizeHousehold($request, $household);

        return $household->load(['members', 'reviewer:id,name']);
    }

    /** Walk-in registration: verified in person, so it is approved immediately. */
    public function store(Request $request)
    {
        $data = $this->validateHousehold($request);

        $household = new Household([
            'barangay_id' => $request->user()->barangay_id,
            'registration_type' => 'walk_in',
            'status' => 'pending',
        ]);

        $this->service->save($household, $data);
        $this->service->approve($household, $request->user());

        return response()->json($household->load('members'), 201);
    }

    public function update(Request $request, Household $household)
    {
        $this->authorizeHousehold($request, $household);
        $this->service->save($household, $this->validateHousehold($request));

        return $household->load('members');
    }

    public function approve(Request $request, Household $household)
    {
        $this->authorizeHousehold($request, $household);
        $this->ensurePending($household);

        return $this->service->approve($household, $request->user());
    }

    public function reject(Request $request, Household $household)
    {
        $this->authorizeHousehold($request, $household);
        $this->ensurePending($household);
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']]);

        return $this->service->reject($household, $request->user(), $data['reason']);
    }

    // ---------------------------------------------------------------

    private function scoped(Request $request)
    {
        abort_unless($request->user()->barangay_id, 403, 'Your account is not assigned to a barangay.');

        return Household::where('barangay_id', $request->user()->barangay_id);
    }

    private function authorizeHousehold(Request $request, Household $household): void
    {
        abort_unless((int) $household->barangay_id === (int) $request->user()->barangay_id, 404);
    }

    private function ensurePending(Household $household): void
    {
        if ($household->status !== 'pending') {
            throw ValidationException::withMessages(['status' => 'This registration has already been reviewed.']);
        }
    }

    private function validateHousehold(Request $request): array
    {
        return $request->validate([
            'purok' => ['required', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'contact_number' => ['nullable', 'regex:/^09\d{9}$/'],
            'is_solo_parent' => ['boolean'],
            'members' => ['required', 'array', 'min:1', 'max:30'],
            'members.0.relationship' => ['in:Head'],
            'members.*.full_name' => ['required', 'string', 'max:150'],
            'members.*.relationship' => ['required', 'in:Head,Spouse,Child,Parent,Sibling,Grandchild,Relative,Other'],
            'members.*.birthdate' => ['required', 'date', 'before_or_equal:today'],
            'members.*.sex' => ['required', 'in:M,F'],
            'members.*.is_pwd' => ['boolean'],
            'members.*.is_pregnant' => ['boolean'],
        ], [
            'contact_number.regex' => 'Contact number must be 11 digits starting with 09.',
            'members.0.relationship.in' => 'The first member listed must be the household head.',
            'members.*.full_name.required' => 'Every member needs a full name.',
            'members.*.birthdate.required' => 'Every member needs a birthdate.',
            'members.*.sex.required' => 'Select the sex of every member.',
        ]);
    }
}
