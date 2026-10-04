<?php

namespace App\Http\Controllers\Api\Barangay;

use App\Http\Controllers\Controller;
use App\Models\Distribution;
use App\Models\Household;
use App\Models\HouseholdDocument;
use App\Services\HouseholdService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
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
            ->withCount('distributions as claims_count') // households with claims can't be deleted
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

        return $household->load(['members', 'reviewer:id,name', 'documents']);
    }

    /** Streams an uploaded document (valid ID, birth certificate) from private storage. */
    public function document(Request $request, Household $household, HouseholdDocument $document)
    {
        $this->authorizeHousehold($request, $household);
        abort_unless((int) $document->household_id === (int) $household->id, 404);
        abort_unless(Storage::disk('local')->exists($document->path), 404, 'The file is missing from storage.');

        return Storage::disk('local')->response($document->path, $document->original_name);
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

    /**
     * Removes a household registered by mistake (e.g. a duplicate or a test entry).
     * Households that already received aid can't be deleted: their claims are the audit trail.
     */
    public function destroy(Request $request, Household $household)
    {
        $this->authorizeHousehold($request, $household);

        if ($household->distributions()->exists()) {
            throw ValidationException::withMessages([
                'household' => 'This household has already received aid, so it cannot be deleted. Edit it instead if details changed.',
            ]);
        }

        foreach ($household->documents as $doc) {
            Storage::disk('local')->delete($doc->path);
        }
        $household->delete(); // members and documents are removed with it

        return response()->noContent();
    }

    /** Every aid this household received: when, what event, goods or cash, and how much. */
    public function claims(Request $request, Household $household)
    {
        $this->authorizeHousehold($request, $household);

        $claims = Distribution::with(['item', 'event', 'personnel:id,name'])
            ->where('household_id', $household->id)
            ->latest('distributed_at')
            ->get();

        return response()->json([
            'summary' => [
                'claims' => $claims->count(),
                'events' => $claims->pluck('distribution_event_id')->filter()->unique()->count(),
                'goods_units' => (int) $claims->filter(fn ($c) => ! $c->item->isCash())->sum('quantity'),
                'cash_total' => (int) $claims->filter(fn ($c) => $c->item->isCash())->sum('quantity'),
                'last_claimed_at' => $claims->first()?->distributed_at,
            ],
            'claims' => $claims->map(fn ($c) => [
                'id' => $c->id,
                'distributed_at' => $c->distributed_at,
                'event' => $c->event?->name ?? 'Earlier distribution (not linked to an event)',
                'event_status' => $c->event?->status,
                'type' => $c->item->isCash() ? 'Cash aid' : 'Relief goods',
                'item' => $c->item->name,
                'eligibility' => $c->event?->eligibility_label,
                'quantity_label' => $c->item->describeQuantity($c->quantity),
                'verification_method' => $c->verification_method,
                'synced_from_offline' => $c->synced_from_offline,
                'released_by' => $c->personnel?->name,
            ]),
        ]);
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
