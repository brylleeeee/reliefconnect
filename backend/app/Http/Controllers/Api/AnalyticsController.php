<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Barangay;
use App\Models\Distribution;
use App\Models\Household;
use App\Models\ReliefItem;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * LGU Admin: Dashboard analytics.
 *
 * Filters (all optional, panel recommendation after the alpha test):
 *  - from / to: the period (default: the last 30 days, today included)
 *  - barangay_id: one barangay instead of the whole municipality
 *  - relief_item_id: one relief item or cash fund
 *
 * Period figures (households reached, goods and cash released, the per-day chart) follow every filter.
 * Current counts (registered and pending households, priority mix) follow the barangay filter only,
 * because they are "right now" numbers, not something that happened in the period.
 */
class AnalyticsController extends Controller
{
    /** Longest period accepted, so a typo like year 2006 doesn't scan the whole table. */
    private const MAX_DAYS = 3 * 366;

    public function overview(Request $request)
    {
        $f = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'barangay_id' => ['nullable', 'integer', 'exists:barangays,id'],
            'relief_item_id' => ['nullable', 'integer', 'exists:relief_items,id'],
        ], [
            'to.after_or_equal' => 'The end date must be on or after the start date.',
        ]);

        $to = isset($f['to']) ? Carbon::parse($f['to'])->endOfDay() : now()->endOfDay();
        $from = isset($f['from']) ? Carbon::parse($f['from'])->startOfDay() : $to->copy()->subDays(29)->startOfDay();
        if ($from->diffInDays($to) > self::MAX_DAYS) {
            $from = $to->copy()->subDays(self::MAX_DAYS)->startOfDay();
        }

        $barangayId = $f['barangay_id'] ?? null;
        $itemId = $f['relief_item_id'] ?? null;

        // Every claim in the period that matches the filters
        $claims = fn () => Distribution::query()
            ->whereBetween('distributed_at', [$from, $to])
            ->when($itemId, fn ($q) => $q->where('relief_item_id', $itemId))
            ->when($barangayId, fn ($q) => $q->whereHas('household', fn ($h) => $h->where('barangay_id', $barangayId)));

        $households = fn () => Household::query()->when($barangayId, fn ($q) => $q->where('barangay_id', $barangayId));
        $inPeriod = fn ($d) => $d->whereBetween('distributed_at', [$from, $to])
            ->when($itemId, fn ($q) => $q->where('relief_item_id', $itemId));

        // Goods and cash are counted separately: pesos must never be added to pack counts
        $goods = fn ($q) => $q->where('type', 'goods');
        $cash = fn ($q) => $q->where('type', 'cash');

        $approved = $households()->where('status', 'approved')->count();
        $reached = $households()->where('status', 'approved')->whereHas('distributions', $inPeriod)->count();

        $byBarangay = Barangay::orderBy('name')
            ->when($barangayId, fn ($q) => $q->whereKey($barangayId))
            ->withCount([
                'households as registered' => fn ($q) => $q->where('status', 'approved'),
                'households as reached' => fn ($q) => $q->where('status', 'approved')->whereHas('distributions', $inPeriod),
                'households as pending' => fn ($q) => $q->where('status', 'pending'),
            ])->get(['id', 'name']);

        $methods = $claims()
            ->selectRaw('verification_method, COUNT(*) as total')
            ->groupBy('verification_method')
            ->pluck('total', 'verification_method');

        $priorityMix = $households()->where('status', 'approved')
            ->selectRaw('priority_level, COUNT(*) as total')
            ->groupBy('priority_level')
            ->pluck('total', 'priority_level');

        $stock = ReliefItem::goods()->when($itemId, fn ($q) => $q->whereKey($itemId))->orderBy('name')->get();
        [$granularity, $series] = $this->series($claims()->whereHas('item', $goods), $from, $to);

        return response()->json([
            'filters' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'days' => (int) $from->diffInDays($to) + 1,
                'barangay_id' => $barangayId,
                'relief_item_id' => $itemId,
                'granularity' => $granularity, // day, week or month: how the chart is grouped
            ],
            'options' => [
                'barangays' => Barangay::orderBy('name')->get(['id', 'name']),
                'items' => ReliefItem::orderBy('type')->orderBy('name')->get(['id', 'name', 'unit', 'type']),
            ],
            'kpis' => [
                'registered_households' => $approved,
                'pending_registrations' => $households()->where('status', 'pending')->count(),
                'units_distributed' => (int) $claims()->whereHas('item', $goods)->sum('quantity'),
                'cash_released' => (int) $claims()->whereHas('item', $cash)->sum('quantity'),
                'cash_available' => (int) ReliefItem::cash()->sum('quantity_in_stock'),
                'coverage_pct' => $approved ? (int) round($reached / $approved * 100) : 0,
                'households_reached' => $reached,
                'offline_synced' => $claims()->where('synced_from_offline', true)->count(),
                'low_stock_items' => $stock->where('is_low_stock', true)->count(),
            ],
            'daily' => $series, // kept as "daily" so older screens still read it
            'by_barangay' => $byBarangay,
            'verification' => [
                'qr' => (int) ($methods['qr'] ?? 0),
                'reference_number' => (int) ($methods['reference_number'] ?? 0),
            ],
            'priority_mix' => [
                'high' => (int) ($priorityMix['high'] ?? 0),
                'medium' => (int) ($priorityMix['medium'] ?? 0),
                'low' => (int) ($priorityMix['low'] ?? 0),
            ],
            'stock' => $stock->map(fn ($i) => [
                'name' => $i->name, 'unit' => $i->unit,
                'in_stock' => $i->quantity_in_stock, 'reorder_level' => $i->reorder_level,
            ]),
        ]);
    }

    /**
     * Units released over the period, zero-filled: per day for up to 2 months,
     * per week up to a year, per month beyond that, so the chart stays readable.
     * Grouped in PHP so it works the same on MySQL and SQLite (tests).
     *
     * @return array{0: string, 1: array<int, array{date: string, units: int}>}
     */
    private function series($query, Carbon $from, Carbon $to): array
    {
        $perDay = $query->selectRaw('DATE(distributed_at) as day, SUM(quantity) as units')
            ->groupBy('day')
            ->pluck('units', 'day');

        $days = (int) $from->diffInDays($to) + 1;
        $granularity = $days <= 62 ? 'day' : ($days <= 366 ? 'week' : 'month');

        $buckets = [];
        for ($d = $from->copy(); $d->lte($to); $d->addDay()) {
            [$key, $label] = match ($granularity) {
                'day' => [$d->toDateString(), $d->format('M j')],
                'week' => [$d->copy()->startOfWeek()->toDateString(), 'Wk of '.$d->copy()->startOfWeek()->format('M j')],
                'month' => [$d->format('Y-m'), $d->format('M Y')],
            };
            $buckets[$key] ??= ['date' => $label, 'units' => 0];
            $buckets[$key]['units'] += (int) ($perDay[$d->toDateString()] ?? 0);
        }

        return [$granularity, array_values($buckets)];
    }
}
