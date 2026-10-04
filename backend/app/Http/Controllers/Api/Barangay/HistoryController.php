<?php

namespace App\Http\Controllers\Api\Barangay;

use App\Http\Controllers\Controller;
use App\Models\BarangayDistribution;
use App\Models\Distribution;
use App\Models\DistributionEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Barangay Admin: Distribution History.
 * Event → distribution days (Day 1, Day 2… by the date claims were made) → households that claimed.
 */
class HistoryController extends Controller
{
    public function index(Request $request)
    {
        $barangayId = $this->barangayId($request);

        $rows = BarangayDistribution::with('event.item')
            ->where('barangay_id', $barangayId)
            ->get()
            ->sortByDesc(fn ($bd) => $bd->started_at ?? $bd->scheduled_at ?? $bd->event->created_at)
            ->values();

        // Claims per event per calendar day, for this barangay only
        $perDay = Distribution::whereNotNull('distribution_event_id')
            ->whereHas('household', fn ($q) => $q->where('barangay_id', $barangayId))
            ->selectRaw('distribution_event_id, DATE(distributed_at) as day, COUNT(*) as households, SUM(quantity) as quantity')
            ->groupBy('distribution_event_id', 'day')
            ->orderBy('day')
            ->get()
            ->groupBy('distribution_event_id');

        return response()->json($rows->map(function ($bd) use ($perDay) {
            $e = $bd->event;
            $days = ($perDay[$e->id] ?? collect())->values()->map(fn ($d, $i) => [
                'day_number' => $i + 1,
                'date' => $d->day,
                'households' => (int) $d->households,
                'quantity_label' => $e->item->describeQuantity((int) $d->quantity),
            ]);

            return [
                'event_id' => $e->id,
                'name' => $e->name,
                'type' => $e->item->isCash() ? 'Cash aid' : 'Relief goods',
                'item' => $e->item->name,
                'eligibility_label' => $e->eligibility_label,
                'amount_label' => $e->item->describeQuantity($e->quantity_per_household).' per '.$e->recipient_label,
                'event_status' => $e->status,
                'status' => $bd->status,
                'scheduled_at' => $bd->scheduled_at,
                'venue' => $bd->venue,
                'quota' => $bd->quota,
                'claimed' => $days->sum('households'),
                'days' => $days,
            ];
        }));
    }

    /** Households that claimed in one event, optionally on one day. */
    public function claims(Request $request, DistributionEvent $event)
    {
        $barangayId = $this->barangayId($request);
        abort_unless($event->forBarangay($barangayId), 404, 'This event does not include your barangay.');

        $f = $request->validate(['date' => ['nullable', 'date_format:Y-m-d']]);

        $claims = Distribution::with(['household:id,reference_number,household_head,purok,members_count,priority_level,priority_score', 'personnel:id,name'])
            ->where('distribution_event_id', $event->id)
            ->whereHas('household', fn ($q) => $q->where('barangay_id', $barangayId))
            ->when($f['date'] ?? null, fn ($q, $d) => $q->whereBetween('distributed_at', [
                Carbon::parse($d)->startOfDay(), Carbon::parse($d)->endOfDay(),
            ]))
            ->orderBy('distributed_at')
            ->get();

        return response()->json($claims->map(fn ($c) => [
            'id' => $c->id,
            'distributed_at' => $c->distributed_at,
            'reference_number' => $c->household->reference_number,
            'household_head' => $c->household->household_head,
            'purok' => $c->household->purok,
            'members_count' => $c->household->members_count,
            'priority_level' => $c->household->priority_level,
            'priority_score' => $c->household->priority_score,
            'quantity_label' => $event->item->describeQuantity($c->quantity),
            'verification_method' => $c->verification_method,
            'released_by' => $c->personnel?->name,
        ]));
    }

    private function barangayId(Request $request): int
    {
        abort_unless($request->user()->barangay_id, 403, 'Your account is not assigned to a barangay.');

        return (int) $request->user()->barangay_id;
    }
}
