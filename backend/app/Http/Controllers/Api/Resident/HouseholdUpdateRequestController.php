<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Controller;
use App\Models\Household;
use App\Models\HouseholdUpdateRequest;
use App\Services\HouseholdUpdateService;
use Illuminate\Http\Request;

/**
 * Resident app: ask the barangay to update the household's details or family members.
 * The household stays as it is until the barangay approves the request.
 */
class HouseholdUpdateRequestController extends Controller
{
    public function __construct(private HouseholdUpdateService $service) {}

    /** The resident's latest request (any status), or null if they never sent one. */
    public function show(Request $request)
    {
        $household = $this->own($request);
        $latest = $household?->updateRequests()->latest('id')->first();

        return response()->json($latest ? $this->present($latest) : null);
    }

    public function store(Request $request)
    {
        $household = $this->own($request);
        abort_unless($household, 404, 'No household registered yet.');

        $data = $request->validate([
            'purok' => ['required', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'is_solo_parent' => ['nullable', 'boolean'],
            'members' => ['required', 'array', 'min:1', 'max:30'],
            'members.0.relationship' => ['in:Head'],
            'members.*.full_name' => ['required', 'string', 'max:150'],
            'members.*.relationship' => ['required', 'in:Head,Spouse,Child,Parent,Sibling,Grandchild,Relative,Other'],
            'members.*.birthdate' => ['required', 'date', 'before_or_equal:today'],
            'members.*.sex' => ['required', 'in:M,F'],
            'members.*.is_pwd' => ['boolean'],
            'members.*.is_pregnant' => ['boolean'],
            'reason' => ['required', 'string', 'max:500'],
        ], [
            'members.0.relationship.in' => 'The first member listed must be the household head.',
            'members.*.full_name.required' => 'Every member needs a full name.',
            'members.*.birthdate.required' => 'Every member needs a birthdate.',
            'members.*.sex.required' => 'Select the sex of every member.',
            'reason.required' => 'Tell your barangay what changed, e.g. "New baby born in October" or "Corrected my birthdate".',
        ]);

        $reason = $data['reason'];
        unset($data['reason']);

        $update = $this->service->submit($household, $request->user(), $data, $reason);

        return response()->json($this->present($update), 201);
    }

    /** Cancel the waiting request, e.g. to send a corrected one. */
    public function destroy(Request $request)
    {
        $household = $this->own($request);
        $pending = $household?->updateRequests()->where('status', 'pending')->latest('id')->first();
        abort_unless($pending, 404, 'You have no request waiting for review.');

        return response()->json($this->present($this->service->cancel($pending)));
    }

    private function own(Request $request): ?Household
    {
        return Household::where('user_id', $request->user()->id)->latest('id')->first();
    }

    private function present(HouseholdUpdateRequest $r): array
    {
        return [
            'id' => $r->id,
            'status' => $r->status,
            'reason' => $r->reason,
            'review_note' => $r->review_note,
            'submitted_at' => $r->created_at,
            'reviewed_at' => $r->reviewed_at,
            'summary' => $r->status === 'pending' ? $this->service->diff($r) : null,
        ];
    }
}
