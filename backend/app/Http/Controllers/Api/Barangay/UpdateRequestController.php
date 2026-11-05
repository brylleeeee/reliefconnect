<?php

namespace App\Http\Controllers\Api\Barangay;

use App\Http\Controllers\Controller;
use App\Models\HouseholdUpdateRequest;
use App\Services\HouseholdUpdateService;
use Illuminate\Http\Request;

/**
 * Barangay Admin: review residents' requests to update their household details.
 * Only requests from households in the admin's own barangay are visible.
 */
class UpdateRequestController extends Controller
{
    public function __construct(private HouseholdUpdateService $service) {}

    public function index(Request $request)
    {
        $f = $request->validate([
            'status' => ['nullable', 'in:pending,approved,rejected,cancelled,all'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);
        $status = $f['status'] ?? 'pending';

        $page = $this->scoped($request)
            ->with(['household:id,household_head,purok,reference_number,priority_level,priority_score', 'reviewer:id,name'])
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->when($f['search'] ?? null, fn ($q, $s) => $q->whereHas('household', fn ($h) => $h->where(fn ($w) => $w
                ->where('household_head', 'like', "%$s%")->orWhere('reference_number', 'like', "%$s%"))))
            // Waiting requests: oldest first (first come, first served); reviewed ones: newest first
            ->when($status === 'pending', fn ($q) => $q->oldest(), fn ($q) => $q->latest())
            ->paginate(15)->withQueryString();

        $page->getCollection()->transform(fn ($r) => [
            'id' => $r->id,
            'status' => $r->status,
            'reason' => $r->reason,
            'review_note' => $r->review_note,
            'household' => $r->household,
            'reviewer' => $r->reviewer?->name,
            'submitted_at' => $r->created_at,
            'reviewed_at' => $r->reviewed_at,
            'changes_count' => $r->status === 'pending' ? $this->service->diff($r)['count'] : null,
        ]);

        return $page;
    }

    public function show(Request $request, HouseholdUpdateRequest $updateRequest)
    {
        $this->authorizeRequest($request, $updateRequest);
        $updateRequest->load(['household.members', 'requester:id,name,phone', 'reviewer:id,name']);

        return response()->json([
            'id' => $updateRequest->id,
            'status' => $updateRequest->status,
            'reason' => $updateRequest->reason,
            'review_note' => $updateRequest->review_note,
            'submitted_at' => $updateRequest->created_at,
            'reviewed_at' => $updateRequest->reviewed_at,
            'requester' => $updateRequest->requester,
            'reviewer' => $updateRequest->reviewer?->name,
            'household' => $updateRequest->household,
            'proposed' => $updateRequest->changes,
            // Only meaningful while waiting: after approval the household already matches the request
            'diff' => $updateRequest->status === 'pending' ? $this->service->diff($updateRequest) : null,
        ]);
    }

    public function approve(Request $request, HouseholdUpdateRequest $updateRequest)
    {
        $this->authorizeRequest($request, $updateRequest);
        $this->service->approve($updateRequest, $request->user());

        return response()->json([
            'message' => "Updated the household of {$updateRequest->household->fresh()->household_head}.",
        ]);
    }

    public function reject(Request $request, HouseholdUpdateRequest $updateRequest)
    {
        $this->authorizeRequest($request, $updateRequest);
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']]);
        $this->service->reject($updateRequest, $request->user(), $data['reason']);

        return response()->json(['message' => "Rejected the update request of {$updateRequest->household->household_head}."]);
    }

    // ---------------------------------------------------------------

    private function scoped(Request $request)
    {
        abort_unless($request->user()->barangay_id, 403, 'Your account is not assigned to a barangay.');

        return HouseholdUpdateRequest::whereHas('household', fn ($q) => $q->where('barangay_id', $request->user()->barangay_id));
    }

    private function authorizeRequest(Request $request, HouseholdUpdateRequest $r): void
    {
        abort_unless((int) $r->household->barangay_id === (int) $request->user()->barangay_id, 404);
    }
}
