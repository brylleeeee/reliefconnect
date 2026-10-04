<?php

namespace App\Http\Controllers\Api\Barangay;

use App\Http\Controllers\Controller;
use App\Models\BarangayDistribution;
use App\Models\Distribution;
use App\Models\DistributionEvent;
use App\Models\Household;
use App\Support\ClaimDetails;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Barangay Admin: runs the barangay's own distribution day for each LGU event.
 * The barangay sets when and where, starts and closes it, and follows up on
 * households that haven't claimed. It cannot change quotas or who is eligible.
 */
class DistributionController extends Controller
{
    /** Events that include this barangay, with this barangay's schedule, status, quota and claims. */
    public function index(Request $request)
    {
        $barangayId = $this->barangayId($request);

        $rows = BarangayDistribution::with('event.item')
            ->where('barangay_id', $barangayId)
            ->join('distribution_events', 'distribution_events.id', '=', 'barangay_distributions.distribution_event_id')
            ->orderByRaw("FIELD(distribution_events.status, 'open', 'closed')")
            ->orderByRaw("FIELD(barangay_distributions.status, 'ongoing', 'scheduled', 'unscheduled', 'closed')")
            ->latest('distribution_events.created_at')
            ->select('barangay_distributions.*')
            ->get();

        return response()->json($rows->map(fn ($bd) => $this->present($bd)));
    }

    /** Set or change the distribution day. Allowed until the barangay starts. */
    public function schedule(Request $request, DistributionEvent $event)
    {
        $bd = $this->rowFor($request, $event);
        $this->ensureEventOpen($event);
        if (! in_array($bd->status, ['unscheduled', 'scheduled'], true)) {
            throw ValidationException::withMessages(['status' => 'The schedule can only be changed before the distribution starts.']);
        }

        $data = $request->validate([
            'scheduled_at' => ['required', 'date', 'after_or_equal:today'],
            'venue' => ['required', 'string', 'max:255'],
        ], [
            'scheduled_at.after_or_equal' => 'Choose today or a later date.',
        ]);

        if ($event->distribute_by && Carbon::parse($data['scheduled_at'])->startOfDay()->gt($event->distribute_by)) {
            throw ValidationException::withMessages([
                'scheduled_at' => 'The LGU asked barangays to distribute by '.$event->distribute_by->format('M j, Y').'.',
            ]);
        }

        $bd->update($data + ['status' => 'scheduled', 'updated_by' => $request->user()->id]);

        // TODO (mobile): notify this barangay's residents of the schedule (push / SMS)

        return $this->present($bd->fresh('event.item'));
    }

    /** Opens claiming for this barangay's households. */
    public function start(Request $request, DistributionEvent $event)
    {
        $bd = $this->rowFor($request, $event);
        $this->ensureEventOpen($event);
        if ($bd->status !== 'scheduled') {
            throw ValidationException::withMessages([
                'status' => $bd->status === 'unscheduled'
                    ? 'Set the date and venue before starting.'
                    : 'This distribution has already started or closed.',
            ]);
        }

        $bd->update(['status' => 'ongoing', 'started_at' => now(), 'updated_by' => $request->user()->id]);

        return $this->present($bd->fresh('event.item'));
    }

    /** Stops claiming for this barangay. Unclaimed quota becomes available for other events. */
    public function close(Request $request, DistributionEvent $event)
    {
        $bd = $this->rowFor($request, $event);
        if ($bd->status !== 'ongoing') {
            throw ValidationException::withMessages(['status' => 'Only an ongoing distribution can be closed.']);
        }

        $bd->update(['status' => 'closed', 'closed_at' => now(), 'updated_by' => $request->user()->id]);

        return $this->present($bd->fresh('event.item'));
    }

    /** Who has and hasn't claimed. Not-yet-claimed first, most vulnerable first. */
    public function households(Request $request, DistributionEvent $event)
    {
        $bd = $this->rowFor($request, $event);

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

        // Only households that can receive in this event (e.g. those with a senior)
        $base = DistributionEvent::applyEligibility(
            Household::where('barangay_id', $bd->barangay_id)->where('status', 'approved'), $event->eligibility
        );
        $hasClaim = fn ($q) => $q->where('distribution_event_id', $event->id);

        $list = (clone $base)
            ->select(['id', 'reference_number', 'household_head', 'purok', 'contact_number',
                'members_count', 'priority_level', 'priority_score',
                'seniors_count', 'pwd_count', 'infants_count', 'pregnant_count'])
            ->addSelect(['claimed_at' => $claimedAt])
            ->when(($f['claim'] ?? null) === 'claimed', fn ($q) => $q->whereHas('distributions', $hasClaim))
            ->when(($f['claim'] ?? null) === 'unclaimed', fn ($q) => $q->whereDoesntHave('distributions', $hasClaim))
            ->when($f['purok'] ?? null, fn ($q, $v) => $q->where('purok', $v))
            ->when($f['priority'] ?? null, fn ($q, $v) => $q->where('priority_level', $v))
            ->when($f['search'] ?? null, fn ($q, $s) => $q->where(fn ($w) => $w
                ->where('household_head', 'like', "%$s%")
                ->orWhere('reference_number', 'like', "%$s%")))
            ->orderByRaw('EXISTS (SELECT 1 FROM distributions d WHERE d.household_id = households.id AND d.distribution_event_id = ?)', [$event->id])
            ->orderByDesc('priority_score')
            ->orderBy('household_head')
            ->paginate(15)->withQueryString();

        $approved = (clone $base)->count();
        $claimed = $bd->claimedCount();
        $left = max($bd->quota - $claimed, 0);
        $done = $event->status === 'closed' || $bd->status === 'closed';

        // Per purok: households, claimed, and not yet claimed
        $byPurok = (clone $base)
            ->selectRaw('purok, COUNT(*) as households')
            ->selectRaw('SUM(EXISTS (SELECT 1 FROM distributions d WHERE d.household_id = households.id AND d.distribution_event_id = ?)) as claimed', [$event->id])
            ->groupBy('purok')->orderBy('purok')->get()
            ->map(fn ($r) => [
                'purok' => $r->purok,
                'households' => (int) $r->households,
                'claimed' => (int) $r->claimed,
                'not_claimed' => (int) $r->households - (int) $r->claimed,
            ]);

        return response()->json([
            // Households that haven't claimed are "pending" while the distribution can still
            // happen, and "unclaimed" once it is closed.
            'claim_phase' => $done ? 'unclaimed' : 'pending',
            'counts' => [
                'quota' => $bd->quota,
                'approved_households' => $approved,
                'claimed' => $claimed,
                'pending' => $done ? 0 : $left,
                'unclaimed' => $done ? $left : 0,
            ],
            'by_purok' => $byPurok,
            'households' => $list,
        ]);
    }

    /** Full details of one claim by a household in this barangay. */
    public function claim(Request $request, Distribution $distribution)
    {
        abort_unless($distribution->household()->where('barangay_id', $this->barangayId($request))->exists(), 404);

        return response()->json(ClaimDetails::for($distribution));
    }

    /** The claim (if any) of one household in this event, so a row in the list can open its details. */
    public function householdClaim(Request $request, DistributionEvent $event, Household $household)
    {
        abort_unless((int) $household->barangay_id === $this->barangayId($request), 404);
        $claim = Distribution::where('distribution_event_id', $event->id)->where('household_id', $household->id)->firstOrFail();

        return response()->json(ClaimDetails::for($claim));
    }

    // ---------------------------------------------------------------

    private function present(BarangayDistribution $bd): array
    {
        $e = $bd->event;

        return [
            'event_id' => $e->id,
            'name' => $e->name,
            'item' => ['name' => $e->item->name, 'unit' => $e->item->unit, 'type' => $e->item->type],
            'quantity_per_household' => $e->quantity_per_household,
            'eligibility' => $e->eligibility,
            'eligibility_label' => $e->eligibility_label,
            'per_member' => $e->per_member,
            'recipient_label' => $e->recipient_label,
            'distribute_by' => $e->distribute_by?->toDateString(),
            'notes' => $e->notes,
            'event_status' => $e->status,
            'status' => $bd->status,
            'scheduled_at' => $bd->scheduled_at,
            'venue' => $bd->venue,
            'started_at' => $bd->started_at,
            'closed_at' => $bd->closed_at,
            'quota' => $bd->quota,
            'claimed' => $bd->claimedCount(),
        ];
    }

    private function rowFor(Request $request, DistributionEvent $event): BarangayDistribution
    {
        $bd = $event->forBarangay($this->barangayId($request));
        abort_if($bd === null, 404, 'This event does not include your barangay.');

        return $bd->setRelation('event', $event->loadMissing('item'));
    }

    private function ensureEventOpen(DistributionEvent $event): void
    {
        if ($event->status !== 'open') {
            throw ValidationException::withMessages(['status' => 'The LGU has closed this event.']);
        }
    }

    private function barangayId(Request $request): int
    {
        abort_unless($request->user()->barangay_id, 403, 'Your account is not assigned to a barangay.');

        return (int) $request->user()->barangay_id;
    }
}
