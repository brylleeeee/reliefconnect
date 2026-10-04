<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Barangay;
use App\Models\Distribution;
use App\Models\Household;
use App\Models\ReliefItem;

class AnalyticsController extends Controller
{
    public function overview()
    {
        $since = now()->subDays(29)->startOfDay();

        $approved = Household::where('status', 'approved')->count();
        $reached = Household::where('status', 'approved')
            ->whereHas('distributions', fn ($q) => $q->where('distributed_at', '>=', $since))
            ->count();

        // Goods and cash are counted separately: pesos must never be added to pack counts
        $goods = fn ($q) => $q->where('type', 'goods');
        $cash = fn ($q) => $q->where('type', 'cash');

        // Units of relief goods distributed per day (last 30 days, zero-filled)
        $perDay = Distribution::where('distributed_at', '>=', $since)->whereHas('item', $goods)
            ->selectRaw('DATE(distributed_at) as day, SUM(quantity) as units')
            ->groupBy('day')
            ->pluck('units', 'day');

        $daily = collect(range(29, 0))->map(function ($ago) use ($perDay) {
            $d = now()->subDays($ago);

            return ['date' => $d->format('M j'), 'units' => (int) ($perDay[$d->toDateString()] ?? 0)];
        });

        $byBarangay = Barangay::orderBy('name')
            ->withCount([
                'households as registered' => fn ($q) => $q->where('status', 'approved'),
                'households as reached' => fn ($q) => $q->where('status', 'approved')
                    ->whereHas('distributions', fn ($d) => $d->where('distributed_at', '>=', $since)),
                'households as pending' => fn ($q) => $q->where('status', 'pending'),
            ])->get(['id', 'name']);

        $methods = Distribution::where('distributed_at', '>=', $since)
            ->selectRaw('verification_method, COUNT(*) as total')
            ->groupBy('verification_method')
            ->pluck('total', 'verification_method');

        $priorityMix = Household::where('status', 'approved')
            ->selectRaw('priority_level, COUNT(*) as total')
            ->groupBy('priority_level')
            ->pluck('total', 'priority_level');

        $stock = ReliefItem::goods()->orderBy('name')->get();

        return response()->json([
            'kpis' => [
                'registered_households' => $approved,
                'pending_registrations' => Household::where('status', 'pending')->count(),
                'units_distributed_30d' => (int) Distribution::where('distributed_at', '>=', $since)
                    ->whereHas('item', $goods)->sum('quantity'),
                'cash_released_30d' => (int) Distribution::where('distributed_at', '>=', $since)
                    ->whereHas('item', $cash)->sum('quantity'),
                'cash_available' => (int) ReliefItem::cash()->sum('quantity_in_stock'),
                'coverage_pct' => $approved ? round($reached / $approved * 100) : 0,
                'households_reached_30d' => $reached,
                'offline_synced_30d' => Distribution::where('distributed_at', '>=', $since)
                    ->where('synced_from_offline', true)->count(),
                'low_stock_items' => $stock->where('is_low_stock', true)->count(),
            ],
            'daily' => $daily,
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
}
