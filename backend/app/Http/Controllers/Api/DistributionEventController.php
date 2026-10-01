<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Barangay;
use App\Models\BarangayDistribution;
use App\Models\Distribution;
use App\Models\DistributionEvent;
use App\Models\Household;
use App\Models\ReliefItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * LGU Admin: Distribution Events page.
 * The LGU decides WHAT each barangay gets (item, amount per household, quota).
 * Each barangay decides WHEN and WHERE, and starts/closes its own distribution.
 * The LGU watches every barangay live and closes the whole event at the end.
 */
class DistributionEventController extends Controller
{
    /** Data for the "Create event" form. */
    public function options()
    {
        $approved = $this->approvedPerBarangay();

        return response()->json([
            'items' => ReliefItem::orderBy('name')->get(['id', 'name', 'unit', 'quantity_in_stock'])
                ->map(function ($i) {
                    $reserved = DistributionEvent::reservedUnits($i->id);

                    return [
                        'id' => $i->id, 'name' => $i->name, 'unit' => $i->unit,
                        'in_stock' => $i->quantity_in_stock,
                        'reserved' => $reserved,
                        'available' => max($i->quantity_in_stock - $reserved, 0),
                    ];
                }),
            'barangays' => Barangay::orderBy('name')->get(['id', 'name'])
                ->map(fn ($b) => ['id' => $b->id, 'name' => $b->name, 'approved_households' => (int) ($approved[$b->id] ?? 0)]),
        ]);
    }

    public function index(Request $request)
    {
        $status = $request->validate(['status' => ['nullable', 'in:open,closed']])['status'] ?? null;

        $events = DistributionEvent::with(['item', 'barangayDistributions:id,distribution_event_id,status,quota'])
            ->withCount('distributions as claimed')
            ->when($status, fn ($q) => $q->where('status', $status))
            ->boardOrder()
            ->paginate(15)->withQueryString();

        // Quota total and how many barangays are at each stage, for the list view
        $events->getCollection()->transform(function ($e) {
            $rows = $e->barangayDistributions;
            $e->quota = (int) $rows->sum('quota');
            $e->stages = [
                'unscheduled' => $rows->where('status', 'unscheduled')->count(),
                'scheduled' => $rows->where('status', 'scheduled')->count(),
                'ongoing' => $rows->where('status', 'ongoing')->count(),
                'closed' => $rows->where('status', 'closed')->count(),
            ];
            $e->unsetRelation('barangayDistributions');

            return $e;
        });

        return response()->json([
            'stats' => [
                'open_events' => DistributionEvent::where('status', 'open')->count(),
                'barangays_distributing' => BarangayDistribution::where('status', 'ongoing')
                    ->whereHas('event', fn ($q) => $q->where('status', 'open'))->count(),
                'claimed_today' => Distribution::whereNotNull('distribution_event_id')
                    ->where('distributed_at', '>=', now()->startOfDay())->count(),
            ],
            'events' => $events,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'relief_item_id' => ['required', 'exists:relief_items,id'],
            'quantity_per_household' => ['required', 'integer', 'min:1', 'max:50'],
            'distribute_by' => ['nullable', 'date', 'after_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'quotas' => ['required', 'array', 'min:1'],
            'quotas.*.barangay_id' => ['required', 'distinct', 'exists:barangays,id'],
            'quotas.*.quota' => ['required', 'integer', 'min:1'],
        ], [
            'quotas.required' => 'Give at least one barangay a quota.',
            'quotas.*.quota.min' => 'Each quota must be at least 1. Remove barangays that get none.',
            'distribute_by.after_or_equal' => 'The deadline cannot be in the past.',
        ]);

        // A quota can't exceed the barangay's approved households (one claim per household)
        $approved = $this->approvedPerBarangay();
        $names = Barangay::pluck('name', 'id');
        foreach ($data['quotas'] as $i => $q) {
            $max = (int) ($approved[$q['barangay_id']] ?? 0);
            if ($q['quota'] > $max) {
                throw ValidationException::withMessages([
                    "quotas.$i.quota" => "Barangay {$names[$q['barangay_id']]} has only {$max} approved households.",
                ]);
            }
        }

        // Units needed must fit in stock that isn't already promised to another open event
        $item = ReliefItem::findOrFail($data['relief_item_id']);
        $needed = array_sum(array_column($data['quotas'], 'quota')) * $data['quantity_per_household'];
        $available = $item->quantity_in_stock - DistributionEvent::reservedUnits($item->id);
        if ($needed > $available) {
            throw ValidationException::withMessages([
                'quotas' => "This event needs {$needed} {$item->unit}, but only {$available} are available "
                    .'(stock minus what other open events still need).',
            ]);
        }

        $event = DB::transaction(function () use ($data, $request, $item) {
            $event = DistributionEvent::create(
                collect($data)->except('quotas')->all() + ['created_by' => $request->user()->id]
            );
            $event->barangayDistributions()->createMany(array_map(
                fn ($q) => ['barangay_id' => $q['barangay_id'], 'quota' => $q['quota']],
                $data['quotas']
            ));

            // Tell the covered barangays. Each barangay then announces its own day to residents.
            $notice = Announcement::create([
                'user_id' => $request->user()->id,
                'distribution_event_id' => $event->id,
                'category' => 'Distribution',
                'title' => "New relief distribution: {$event->name}",
                'description' => trim(sprintf(
                    '%d %s of %s per household. Check Distributions for your barangay\'s quota and set your distribution day%s. %s',
                    $event->quantity_per_household,
                    $event->quantity_per_household === 1 ? Str::singular($item->unit) : $item->unit,
                    $item->name,
                    $event->distribute_by ? ' on or before '.$event->distribute_by->format('M j, Y') : '',
                    $event->notes ?? ''
                )),
                'published_at' => now(),
            ]);
            $notice->targetBarangays()->sync(array_column($data['quotas'], 'barangay_id'));

            return $event;
        });

        return response()->json($event, 201);
    }

    /** Live view: each barangay's schedule, status, and claimed vs quota, plus the latest claims. */
    public function show(DistributionEvent $event)
    {
        $event->load(['item', 'creator:id,name']);

        $claimedPer = Distribution::where('distribution_event_id', $event->id)
            ->join('households', 'households.id', '=', 'distributions.household_id')
            ->selectRaw('households.barangay_id, COUNT(*) as total')
            ->groupBy('households.barangay_id')
            ->pluck('total', 'barangay_id');

        $rows = $event->barangayDistributions()->with('barangay:id,name')->get();
        $barangays = $rows
            ->map(function ($bd) use ($event, $claimedPer) {
                $claimed = (int) ($claimedPer[$bd->barangay_id] ?? 0);
                $left = max($bd->quota - $claimed, 0);
                // Quota not yet used is "pending" while the barangay can still distribute,
                // and "unclaimed" once its distribution (or the whole event) is closed.
                $done = $this->isDone($event, $bd);

                return [
                    'id' => $bd->barangay_id,
                    'name' => $bd->barangay->name,
                    'quota' => $bd->quota,
                    'claimed' => $claimed,
                    'pending' => $done ? 0 : $left,
                    'unclaimed' => $done ? $left : 0,
                    'status' => $bd->status,
                    'scheduled_at' => $bd->scheduled_at,
                    'venue' => $bd->venue,
                    'started_at' => $bd->started_at,
                    'closed_at' => $bd->closed_at,
                ];
            })->sortBy('name')->values();

        $recent = Distribution::with(['household:id,reference_number,household_head,barangay_id', 'household.barangay:id,name', 'personnel:id,name'])
            ->where('distribution_event_id', $event->id)
            ->latest('distributed_at')->take(10)->get()
            ->map(fn ($d) => [
                'id' => $d->id,
                'reference_number' => $d->household->reference_number,
                'household_head' => $d->household->household_head,
                'barangay' => $d->household->barangay->name,
                'released_by' => $d->personnel->name,
                'verification_method' => $d->verification_method,
                'synced_from_offline' => $d->synced_from_offline,
                'distributed_at' => $d->distributed_at,
            ]);

        // Are the most vulnerable being reached? Approved households in covered barangays, by level.
        $byPriority = Household::where('status', 'approved')
            ->whereIn('barangay_id', $rows->pluck('barangay_id'))
            ->selectRaw('priority_level, COUNT(*) as households')
            ->selectRaw('SUM(EXISTS (SELECT 1 FROM distributions d WHERE d.household_id = households.id AND d.distribution_event_id = ?)) as claimed', [$event->id])
            ->groupBy('priority_level')
            ->get()->keyBy('priority_level');

        return response()->json([
            'event' => $event,
            'totals' => [
                'quota' => $barangays->sum('quota'),
                'claimed' => $barangays->sum('claimed'),
                'pending' => $barangays->sum('pending'),
                'unclaimed' => $barangays->sum('unclaimed'),
            ],
            'barangays' => $barangays,
            'by_priority' => collect(['high', 'medium', 'low'])->map(fn ($level) => [
                'level' => $level,
                'claimed' => (int) ($byPriority[$level]->claimed ?? 0),
                'not_claimed' => (int) (($byPriority[$level]->households ?? 0) - ($byPriority[$level]->claimed ?? 0)),
            ]),
            'recent_claims' => $recent,
            'refreshed_at' => now(),
        ]);
    }

    /**
     * Claimed / pending / unclaimed for one event, for all covered barangays or one of them.
     * "Pending" = quota not yet claimed while the barangay can still distribute;
     * "unclaimed" = quota left over once its distribution (or the whole event) is closed.
     */
    public function analytics(Request $request, DistributionEvent $event)
    {
        $event->load('item');
        $rows = $event->barangayDistributions()->with('barangay:id,name')->get();

        $barangayId = $request->validate([
            'barangay_id' => ['nullable', 'integer', 'in:'.$rows->pluck('barangay_id')->implode(',')],
        ], ['barangay_id.in' => 'This event does not include that barangay.'])['barangay_id'] ?? null;

        $scope = $barangayId ? $rows->where('barangay_id', (int) $barangayId) : $rows;
        $scopeIds = $scope->pluck('barangay_id');

        $claimedPer = Distribution::where('distribution_event_id', $event->id)
            ->join('households', 'households.id', '=', 'distributions.household_id')
            ->whereIn('households.barangay_id', $scopeIds)
            ->selectRaw('households.barangay_id, COUNT(*) as total')
            ->groupBy('households.barangay_id')
            ->pluck('total', 'barangay_id');

        $perBarangay = $scope->map(function ($bd) use ($event, $claimedPer) {
            $claimed = (int) ($claimedPer[$bd->barangay_id] ?? 0);
            $left = max($bd->quota - $claimed, 0);
            $done = $this->isDone($event, $bd);

            return [
                'id' => $bd->barangay_id,
                'name' => $bd->barangay->name,
                'status' => $bd->status,
                'quota' => $bd->quota,
                'claimed' => $claimed,
                'pending' => $done ? 0 : $left,
                'unclaimed' => $done ? $left : 0,
            ];
        })->sortBy('name')->values();

        $claimedExists = 'SUM(EXISTS (SELECT 1 FROM distributions d WHERE d.household_id = households.id AND d.distribution_event_id = ?))';
        $households = Household::where('status', 'approved')->whereIn('barangay_id', $scopeIds);

        // One barangay: break it down by purok (households, since quotas are per barangay)
        $byPurok = $barangayId ? (clone $households)
            ->selectRaw('purok, COUNT(*) as households')
            ->selectRaw("$claimedExists as claimed", [$event->id])
            ->groupBy('purok')->orderBy('purok')->get()
            ->map(fn ($r) => ['purok' => $r->purok, 'claimed' => (int) $r->claimed, 'not_claimed' => (int) $r->households - (int) $r->claimed])
            : [];

        $byPriority = (clone $households)
            ->selectRaw('priority_level, COUNT(*) as households')
            ->selectRaw("$claimedExists as claimed", [$event->id])
            ->groupBy('priority_level')->get()->keyBy('priority_level');

        $claims = Distribution::where('distribution_event_id', $event->id)
            ->whereHas('household', fn ($q) => $q->whereIn('barangay_id', $scopeIds));

        $timeline = (clone $claims)
            ->selectRaw('DATE(distributed_at) as day, COUNT(*) as claims')
            ->groupBy('day')->orderBy('day')->get()
            ->map(fn ($r) => ['day' => $r->day, 'claims' => (int) $r->claims]);

        $methods = (clone $claims)->selectRaw('verification_method, COUNT(*) as total')
            ->groupBy('verification_method')->pluck('total', 'verification_method');

        $one = $barangayId ? $perBarangay->first() : null;

        return response()->json([
            'event' => $event->only(['id', 'name', 'status', 'quantity_per_household']) + [
                'distribute_by' => $event->distribute_by?->toDateString(), // plain date: no timezone shift
                'item' => $event->item->only(['name', 'unit']),
            ],
            'barangays' => $rows->map(fn ($bd) => ['id' => $bd->barangay_id, 'name' => $bd->barangay->name])->sortBy('name')->values(),
            'scope' => $one ? ['id' => $one['id'], 'name' => $one['name'], 'status' => $one['status']] : null,
            'totals' => [
                'quota' => $perBarangay->sum('quota'),
                'claimed' => $perBarangay->sum('claimed'),
                'pending' => $perBarangay->sum('pending'),
                'unclaimed' => $perBarangay->sum('unclaimed'),
            ],
            'per_barangay' => $perBarangay,
            'by_purok' => $byPurok,
            'by_priority' => collect(['high', 'medium', 'low'])->map(fn ($level) => [
                'level' => $level,
                'claimed' => (int) ($byPriority[$level]->claimed ?? 0),
                'not_claimed' => (int) (($byPriority[$level]->households ?? 0) - ($byPriority[$level]->claimed ?? 0)),
            ]),
            'timeline' => $timeline,
            'methods' => ['qr' => (int) ($methods['qr'] ?? 0), 'reference_number' => (int) ($methods['reference_number'] ?? 0)],
        ]);
    }

    /** Ends the event for every barangay. Unclaimed quota becomes available for other events. */
    public function close(DistributionEvent $event)
    {
        if ($event->status !== 'open') {
            throw ValidationException::withMessages(['status' => 'This event is already closed.']);
        }

        DB::transaction(function () use ($event) {
            $event->update(['status' => 'closed', 'closed_at' => now()]);
            $event->barangayDistributions()->where('status', '!=', 'closed')
                ->update(['status' => 'closed', 'closed_at' => now()]);
        });

        return $event->fresh();
    }

    /** Only events where no barangay has started can be deleted; claimed events stay for the audit trail. */
    public function destroy(DistributionEvent $event)
    {
        $started = $event->barangayDistributions()->whereNotNull('started_at')->exists()
            || $event->distributions()->exists();

        if ($started) {
            throw ValidationException::withMessages([
                'status' => 'A barangay already started distributing for this event, so it cannot be deleted. Close it instead.',
            ]);
        }

        $event->delete();

        return response()->noContent();
    }

    /** Barangay list for the announcement form, with approved household counts for context. */
    public function barangays()
    {
        $approved = $this->approvedPerBarangay();

        return Barangay::orderBy('name')->get(['id', 'name'])
            ->map(fn ($b) => ['id' => $b->id, 'name' => $b->name, 'households' => (int) ($approved[$b->id] ?? 0)]);
    }

    private function isDone(DistributionEvent $event, $bd): bool
    {
        return $event->status === 'closed' || $bd->status === 'closed';
    }

    private function approvedPerBarangay()
    {
        return Household::where('status', 'approved')
            ->selectRaw('barangay_id, COUNT(*) as total')
            ->groupBy('barangay_id')
            ->pluck('total', 'barangay_id');
    }
}
