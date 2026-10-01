<?php

namespace App\Http\Controllers\Api\Barangay;

use App\Http\Controllers\Controller;
use App\Models\Distribution;
use App\Models\DistributionEvent;
use App\Models\Household;
use Illuminate\Http\Request;

/**
 * Barangay Admin: who in their barangay has and hasn't claimed during an event,
 * so officials can follow up on unclaimed households (most vulnerable first).
 */
class EventClaimController extends Controller
{
    /** Events that include this barangay, with this barangay's quota and claims. */
    public function index(Request $request)
    {
        $barangayId = $this->barangayId($request);

        $events = DistributionEvent::with('item')
            ->whereHas('barangays', fn ($q) => $q->where('barangays.id', $barangayId))
            ->boardOrder()
            ->get()
            ->map(fn ($e) => [
                'id' => $e->id,
                'name' => $e->name,
                'item' => $e->item,
                'quantity_per_household' => $e->quantity_per_household,
                'scheduled_at' => $e->scheduled_at,
                'venue' => $e->venue,
                'notes' => $e->notes,
                'status' => $e->status,
                'quota' => $e->quotaFor($barangayId),
                'claimed' => $this->claimedCount($e, $barangayId),
            ]);

        return response()->json($events);
    }

    public function households(Request $request, DistributionEvent $event)
    {
        $barangayId = $this->barangayId($request);
        $quota = $event->quotaFor($barangayId);
        abort_if($quota === null, 404, 'This event does not cover your barangay.');

        $f = $request->validate([
            'claim' => ['nullable', 'in:claimed,unclaimed'],
            'search' => ['nullable', 'string', 'max:100'],
            'purok' => ['nullable', 'string', 'max:50'],
            'priority' => ['nullable', 'in:high,medium,low'],
        ]);

        $claimedAt = Distribution::select('distributed_at')
            ->whereColumn('household_id', 'households.id')
            ->where('distribution_event_id', $event->id)
            ->limit(1);

        $base = Household::where('barangay_id', $barangayId)->where('status', 'approved');
        $hasClaim = fn ($q) => $q->where('distribution_event_id', $event->id);

        $list = (clone $base)
            ->select(['id', 'reference_number', 'household_head', 'purok', 'contact_number',
                'members_count', 'priority_level', 'priority_score'])
            ->addSelect(['claimed_at' => $claimedAt])
            ->when(($f['claim'] ?? null) === 'claimed', fn ($q) => $q->whereHas('distributions', $hasClaim))
            ->when(($f['claim'] ?? null) === 'unclaimed', fn ($q) => $q->whereDoesntHave('distributions', $hasClaim))
            ->when($f['purok'] ?? null, fn ($q, $v) => $q->where('purok', $v))
            ->when($f['priority'] ?? null, fn ($q, $v) => $q->where('priority_level', $v))
            ->when($f['search'] ?? null, fn ($q, $s) => $q->where(fn ($w) => $w
                ->where('household_head', 'like', "%$s%")
                ->orWhere('reference_number', 'like', "%$s%")))
            // Not-yet-claimed first, highest priority first, so follow-ups start with the most vulnerable
            ->orderByRaw('EXISTS (SELECT 1 FROM distributions d WHERE d.household_id = households.id AND d.distribution_event_id = ?)', [$event->id])
            ->orderByDesc('priority_score')
            ->orderBy('household_head')
            ->paginate(15)->withQueryString();

        $approved = (clone $base)->count();
        $claimed = $this->claimedCount($event, $barangayId);

        return response()->json([
            'event' => $event->only(['id', 'name', 'status', 'scheduled_at', 'venue', 'quantity_per_household']),
            'counts' => [
                'quota' => $quota,
                'claimed' => $claimed,
                'approved_households' => $approved,
                'not_yet_claimed' => max($approved - $claimed, 0),
                'quota_left' => max($quota - $claimed, 0),
            ],
            'households' => $list,
        ]);
    }

    private function claimedCount(DistributionEvent $event, int $barangayId): int
    {
        return $event->distributions()
            ->whereHas('household', fn ($q) => $q->where('barangay_id', $barangayId))
            ->count();
    }

    private function barangayId(Request $request): int
    {
        abort_unless($request->user()->barangay_id, 403, 'Your account is not assigned to a barangay.');

        return (int) $request->user()->barangay_id;
    }
}
