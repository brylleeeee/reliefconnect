<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Barangay;
use App\Models\Household;
use App\Models\ReliefItem;
use Illuminate\Http\Request;

/**
 * LGU Admin: per-barangay priority breakdown + suggested allocation of a relief item.
 * Only aggregate numbers are returned; no individual household data leaves the barangay.
 */
class PrioritizationController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'relief_item_id' => ['nullable', 'exists:relief_items,id'],
            'packs' => ['nullable', 'integer', 'min:0'],
        ]);

        $items = ReliefItem::orderBy('name')->get(['id', 'name', 'unit', 'quantity_in_stock']);
        $item = isset($data['relief_item_id']) ? $items->firstWhere('id', $data['relief_item_id']) : $items->first();
        $packs = (int) ($data['packs'] ?? $item?->quantity_in_stock ?? 0);

        $stats = Household::where('status', 'approved')
            ->selectRaw("barangay_id,
                COUNT(*) as households,
                SUM(priority_level = 'high') as high,
                SUM(priority_level = 'medium') as medium,
                SUM(priority_level = 'low') as low,
                SUM(members_count) as members,
                SUM(seniors_count) as seniors,
                SUM(pwd_count) as pwd,
                SUM(infants_count) as infants,
                SUM(pregnant_count) as pregnant")
            ->groupBy('barangay_id')
            ->get()->keyBy('barangay_id');

        $w = config('relief.allocation_weights');

        $rows = Barangay::orderBy('name')->get()->map(function ($b) use ($stats, $w) {
            $s = $stats->get($b->id);
            $row = ['id' => $b->id, 'name' => $b->name];
            foreach (['households', 'high', 'medium', 'low', 'members', 'seniors', 'pwd', 'infants', 'pregnant'] as $k) {
                $row[$k] = (int) ($s->$k ?? 0);
            }
            $row['demand'] = $row['high'] * $w['high'] + $row['medium'] * $w['medium'] + $row['low'] * $w['low'];

            return $row;
        })->all();

        $rows = $this->allocate($rows, $packs);

        return response()->json([
            'items' => $items,
            'selected_item' => $item,
            'packs' => $packs,
            'total_households' => array_sum(array_column($rows, 'households')),
            'barangays' => $rows,
            'rules' => [
                'priority_weights' => config('relief.priority_weights'),
                'priority_levels' => config('relief.priority_levels'),
                'allocation_weights' => $w,
            ],
        ]);
    }

    /**
     * Split packs in proportion to priority-weighted demand, never giving a barangay more
     * packs than it has households (one pack per household per event), then fill each
     * barangay's quota from high → medium → low priority.
     */
    private function allocate(array $rows, int $packs): array
    {
        $alloc = array_fill_keys(array_keys($rows), 0);
        $open = array_keys(array_filter($rows, fn ($r) => $r['households'] > 0));
        $remaining = $packs;

        // Repeat until packs run out or every barangay is fully covered
        while ($remaining > 0 && $open) {
            $demand = array_sum(array_map(fn ($i) => $rows[$i]['demand'], $open));
            $shares = [];
            foreach ($open as $i) {
                $exact = $remaining * $rows[$i]['demand'] / max($demand, 1);
                $shares[$i] = ['floor' => (int) floor($exact), 'frac' => $exact - floor($exact)];
            }

            // Largest-remainder rounding so the total equals $remaining exactly
            $left = $remaining - array_sum(array_column($shares, 'floor'));
            uasort($shares, fn ($a, $b) => $b['frac'] <=> $a['frac']);
            foreach ($shares as $i => &$sh) {
                if ($left-- > 0) $sh['floor']++;
            }
            unset($sh);

            $given = 0;
            $stillOpen = [];
            foreach ($open as $i) {
                $cap = $rows[$i]['households'] - $alloc[$i];
                $take = min($shares[$i]['floor'], $cap);
                $alloc[$i] += $take;
                $given += $take;
                if ($alloc[$i] < $rows[$i]['households']) $stillOpen[] = $i;
            }

            $remaining -= $given;
            if ($given === 0) break;
            $open = $stillOpen;
        }

        foreach ($rows as $i => &$r) {
            $a = $alloc[$i];
            $r['allocation'] = $a;
            $r['covered_high'] = min($r['high'], $a);
            $r['covered_medium'] = min($r['medium'], $a - $r['covered_high']);
            $r['covered_low'] = min($r['low'], $a - $r['covered_high'] - $r['covered_medium']);
            $r['coverage_pct'] = $r['households'] ? round($a / $r['households'] * 100) : 0;
        }

        return $rows;
    }
}
