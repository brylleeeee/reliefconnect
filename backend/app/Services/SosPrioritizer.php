<?php

namespace App\Services;

use App\Models\Household;
use App\Models\SosAlert;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Ranks barangays by how urgently they need relief goods, from their pending SOS.
 *
 * Barangay score = base score (people affected + waiting time)
 *                + AI points (from each resident's SOS message, see SosMessageAnalyzer)
 *                + vulnerability points (from Aid Prioritization: the household's high/medium/low priority level).
 * All of it is saved or looked up per SOS, so the dashboard never calls the AI while it refreshes.
 *
 * Always ready: the ranking is cached and rebuilt only when an SOS or household changes (a new SOS, the AI
 * finishing a message, an SOS served or withdrawn, a priority level updated), or after a minute because
 * waiting time keeps adding points. Every page that shows SOS priority reads the same cached result.
 */
class SosPrioritizer
{
    /** Seconds a ranking is reused when nothing changed (waiting time drifts slowly). */
    private const MAX_AGE = 60;

    /**
     * @return array{engine: string, rows: Collection<int, array>, computed_at: string, analyzing: int, fallback: int}
     *               rows are highest priority first
     */
    public function rank(): array
    {
        $cached = Cache::remember('sos:ranking:'.$this->fingerprint(), self::MAX_AGE, fn () => $this->compute());

        // Cached as plain arrays (the cache doesn't store objects); rows go back into a Collection here
        return ['rows' => collect($cached['rows'])] + $cached;
    }

    /**
     * Changes whenever anything the ranking depends on changes. Query-builder updates (e.g. serving all SOS of
     * a barangay) still touch updated_at, so they are noticed too; the point and queue sums catch changes made
     * within the same second as the last rebuild.
     */
    private function fingerprint(): string
    {
        $sos = DB::table('sos_alerts')->selectRaw("COUNT(*) AS c, MAX(updated_at) AS u,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS n,
            SUM(CASE WHEN status = 'pending' THEN ai_points ELSE 0 END) AS p,
            SUM(CASE WHEN ai_status = 'queued' THEN 1 ELSE 0 END) AS q")->first();
        $households = DB::table('households')->max('updated_at');

        return md5(json_encode([$sos, $households]));
    }

    private function compute(): array
    {
        $alerts = SosAlert::with('barangay:id,name')->where('status', 'pending')->get();
        $maxHours = (float) config('relief.sos.waiting_max_hours');
        $vuln = $this->vulnerability($alerts);

        $rows = $alerts->groupBy('barangay_id')->map(function (Collection $a, $id) use ($maxHours, $vuln) {
            $base = round($a->sum(fn ($x) => $this->baseScore($x, $maxHours)), 1);
            $ai = (int) $a->sum('ai_points');
            $aid = (int) $a->sum(fn ($x) => $vuln[$x->id]['points']);
            $worst = $a->sortByDesc('ai_points')->first();

            return [
                'id' => (int) $id,
                'name' => $a->first()->barangay->name,
                'sos_count' => $a->count(),
                'people' => (int) $a->sum('people_count'),
                'waiting_minutes' => (int) $a->min('created_at')->diffInMinutes(now(), true),
                'base_score' => $base,
                'ai_points' => $ai,
                'vulnerability_points' => $aid,
                'high_priority_households' => $a->filter(fn ($x) => $vuln[$x->id]['level'] === 'high')->count(),
                'score' => round($base + $ai + $aid, 1),
                'top_category' => $worst->ai_category,
                'reason' => $worst->ai_points > 0 ? $worst->ai_reason : null,
                'analyzing' => $a->where('ai_status', 'queued')->count(),
            ];
        })->sortByDesc('score')->values();

        $highest = max($rows->max('score') ?? 0, 1);
        $levels = config('relief.sos.levels');

        return [
            'engine' => $this->engine($alerts),
            'rows' => $rows->map(function ($row, $i) use ($highest, $levels) {
                $ratio = $row['score'] / $highest;

                return $row + [
                    'rank' => $i + 1,
                    'level' => $ratio >= $levels['critical'] ? 'critical' : ($ratio >= $levels['high'] ? 'high' : 'moderate'),
                ];
            })->all(),
            'computed_at' => now()->toIso8601String(),
            // SOS messages the AI is still reading (scored by the rules for now), and ones it couldn't read
            'analyzing' => $alerts->where('ai_status', 'queued')->count(),
            'fallback' => $alerts->where('ai_status', 'fallback')->count(),
        ];
    }

    /**
     * Link each SOS to its household's Aid Prioritization level (high / medium / low) and turn it into points.
     * The household is found by household_id, or by the resident's user_id when household_id is empty.
     * Only approved households count.
     *
     * @return array<int, array{level: ?string, points: int}> keyed by SOS id
     */
    private function vulnerability(Collection $alerts): array
    {
        $points = config('relief.sos.vulnerability_points', ['high' => 6, 'medium' => 3, 'low' => 0]);

        $byId = Household::where('status', 'approved')
            ->whereIn('id', $alerts->pluck('household_id')->filter()->unique())
            ->pluck('priority_level', 'id');
        $byUser = Household::where('status', 'approved')
            ->whereIn('user_id', $alerts->pluck('user_id')->filter()->unique())
            ->pluck('priority_level', 'user_id');

        return $alerts->mapWithKeys(function ($a) use ($byId, $byUser, $points) {
            $level = ($a->household_id ? $byId->get($a->household_id) : null)
                ?? ($a->user_id ? $byUser->get($a->user_id) : null);

            return [$a->id => ['level' => $level, 'points' => $level ? (int) ($points[$level] ?? 0) : 0]];
        })->all();
    }

    /** 'ai' when every pending SOS was read by the AI, 'mixed' when some used the built-in rules, else 'rules'. */
    private function engine(Collection $alerts): string
    {
        $ai = $alerts->where('ai_source', 'ai')->count();

        if ($alerts->isEmpty() || $ai === 0) {
            return 'rules';
        }

        return $ai === $alerts->count() ? 'ai' : 'mixed';
    }

    /** Each SOS counts more for bigger households and the longer it has waited. */
    private function baseScore(SosAlert $a, float $maxHours): float
    {
        $hours = $a->created_at->diffInMinutes(now(), true) / 60;

        return 10 * (1 + min($a->people_count, 10) / 10) * (1 + min($hours, $maxHours) / $maxHours * 0.5);
    }
}
