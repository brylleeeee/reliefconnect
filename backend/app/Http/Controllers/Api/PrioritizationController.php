<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Barangay;
use App\Models\DistributionEvent;
use App\Models\Household;
use App\Models\ReliefItem;
use App\Models\SosAlert;
use App\Services\SosPrioritizer;
use Illuminate\Http\Request;

/**
 * LGU Admin: per-barangay priority breakdown + suggested allocation of a relief item.
 * Only aggregate numbers are returned; no individual household data leaves the barangay.
 *
 * SOS: each barangay also gets its SOS priority (rank, level, reason) from SosPrioritizer. Active SOS add to
 * its share of the packs (more for urgent messages), and "Serve SOS barangays first" covers every household
 * that asked, in priority order, before the rest is shared. All of this works without an AI key.
 */
class PrioritizationController extends Controller
{
    public function index(Request $request, SosPrioritizer $prioritizer)
    {
        $data = $request->validate([
            'mode' => ['nullable', 'in:share,sos_first'],
            'relief_item_id' => ['nullable', 'exists:relief_items,id'],
            'packs' => ['nullable', 'integer', 'min:0'],
            // From "Suggest by priority" in Create Event: only count eligible households
            'eligibility' => ['nullable', 'in:'.implode(',', array_keys(DistributionEvent::ELIGIBILITY))],
        ]);

        $items = ReliefItem::orderBy('name')->get(['id', 'name', 'unit', 'quantity_in_stock']);
        $item = isset($data['relief_item_id']) ? $items->firstWhere('id', $data['relief_item_id']) : $items->first();
        $packs = (int) ($data['packs'] ?? $item?->quantity_in_stock ?? 0);

        $stats = DistributionEvent::applyEligibility(Household::where('status', 'approved'), $data['eligibility'] ?? 'all')
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

        // Active SOS from approved households: each adds allocation_points, plus up to message_points more
        // for an urgent message (scored by SosMessageAnalyzer), so a barangay with people trapped gets more.
        $sosBase = (int) config('relief.sos.allocation_points', 3);
        $sosMsgMax = (int) config('relief.sos.message_points', 4);
        $sosPer = SosAlert::where('status', 'pending')
            ->whereHas('household', fn ($q) => $q->where('status', 'approved'))
            ->get(['barangay_id', 'ai_points'])
            ->groupBy('barangay_id');

        // SOS priority per barangay (rank 1 = serve first), from the same ranking as SOS Prioritization
        ['engine' => $engine, 'rows' => $ranking] = $prioritizer->rank();
        $ranked = $ranking->keyBy('id');

        $rows = Barangay::orderBy('name')->get()->map(function ($b) use ($stats, $w, $sosPer, $sosBase, $sosMsgMax, $ranked) {
            $s = $stats->get($b->id);
            $row = ['id' => $b->id, 'name' => $b->name];
            foreach (['households', 'high', 'medium', 'low', 'members', 'seniors', 'pwd', 'infants', 'pregnant'] as $k) {
                $row[$k] = (int) ($s->$k ?? 0);
            }
            $alerts = $sosPer->get($b->id, collect());
            $row['sos'] = $alerts->count();
            $row['sos_points'] = (int) $alerts->sum(fn ($a) => $sosBase + min($sosMsgMax, intdiv((int) $a->ai_points, 5)));
            $row['demand'] = $row['high'] * $w['high'] + $row['medium'] * $w['medium'] + $row['low'] * $w['low']
                + $row['sos_points'];

            $r = $ranked->get($b->id);
            $row['sos_priority'] = $r ? [
                'rank' => $r['rank'],
                'level' => $r['level'],                 // critical, high, moderate
                'score' => $r['score'],
                'people' => $r['people'],
                'waiting_minutes' => $r['waiting_minutes'],
                'top_category' => $r['top_category'],
                'reason' => $r['reason'],
            ] : null;

            return $row;
        })->all();

        $mode = $data['mode'] ?? 'share';
        $start = $mode === 'sos_first' ? $this->sosFirst($rows, $packs) : [];
        $rows = $this->allocate($rows, $packs - array_sum($start), $start);

        return response()->json([
            'mode' => $mode,
            'engine' => $engine, // 'rules' = built-in scoring (no AI key), 'ai' or 'mixed' when Gemini is used
            'items' => $items,
            'selected_item' => $item,
            'packs' => $packs,
            'total_households' => array_sum(array_column($rows, 'households')),
            'barangays' => $rows,
            'rules' => [
                'priority_weights' => config('relief.priority_weights'),
                'priority_levels' => config('relief.priority_levels'),
                'allocation_weights' => $w,
                'sos_points' => $sosBase,
                'sos_message_points' => $sosMsgMax,
            ],
        ]);
    }

    /**
     * "Serve SOS barangays first": in SOS priority order, each barangay first gets one pack for every
     * household that sent an SOS (never more than its households), until the packs run out.
     *
     * @return array<int, int> packs already given, keyed like $rows
     */
    private function sosFirst(array $rows, int $packs): array
    {
        $given = [];
        $order = array_keys(array_filter($rows, fn ($r) => $r['sos_priority'] && $r['sos'] > 0));
        usort($order, fn ($a, $b) => $rows[$a]['sos_priority']['rank'] <=> $rows[$b]['sos_priority']['rank']);

        foreach ($order as $i) {
            if ($packs <= 0) {
                break;
            }
            $take = min($rows[$i]['sos'], $rows[$i]['households'], $packs);
            $given[$i] = $take;
            $packs -= $take;
        }

        return $given;
    }

    /**
     * Split packs in proportion to priority-weighted demand, never giving a barangay more
     * packs than it has households (one pack per household per event), then fill each
     * barangay's quota from high → medium → low priority. $start = packs already given (SOS first).
     */
    private function allocate(array $rows, int $packs, array $start = []): array
    {
        $alloc = array_fill_keys(array_keys($rows), 0);
        foreach ($start as $i => $n) {
            $alloc[$i] = $n;
        }
        $open = array_keys(array_filter($rows, fn ($r, $i) => $r['households'] > $alloc[$i], ARRAY_FILTER_USE_BOTH));
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
            $r['sos_first_packs'] = $start[$i] ?? 0;
            $r['covered_high'] = min($r['high'], $a);
            $r['covered_medium'] = min($r['medium'], $a - $r['covered_high']);
            $r['covered_low'] = min($r['low'], $a - $r['covered_high'] - $r['covered_medium']);
            $r['coverage_pct'] = $r['households'] ? round($a / $r['households'] * 100) : 0;
        }

        return $rows;
    }
}
