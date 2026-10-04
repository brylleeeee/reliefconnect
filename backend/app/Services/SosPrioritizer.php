<?php

namespace App\Services;

use App\Models\Household;
use App\Models\SosAlert;
use Illuminate\Support\Collection;

/**
 * Ranks barangays by how urgently they need relief goods, from their pending SOS.
 * Gemini does the calculation; if there is no API key (or the call fails) a plain formula is used instead.
 */
class SosPrioritizer
{
    public function __construct(private AiPrioritizationService $ai) {}

    /** @return array{engine: string, rows: Collection<int, array>} rows are highest priority first */
    public function rank(): array
    {
        $groups = SosAlert::with('barangay:id,name')->where('status', 'pending')->get()->groupBy('barangay_id');

        $registered = Household::where('status', 'approved')->whereIn('barangay_id', $groups->keys())
            ->selectRaw('barangay_id, COUNT(*) as c')->groupBy('barangay_id')->pluck('c', 'barangay_id');

        $facts = $groups->map(fn (Collection $a, $id) => [
            'id' => (int) $id,
            'name' => $a->first()->barangay->name,
            'sos_count' => $a->count(),
            'people_affected' => (int) $a->sum('people_count'),
            // Rounded to 15 minutes so the facts (and the AI answer cache) don't change every minute
            'longest_wait_minutes' => (int) (round($a->min('created_at')->diffInMinutes(now(), true) / 15) * 15),
            'new_sos_last_hour' => $a->filter(fn ($x) => $x->created_at >= now()->subHour())->count(),
            'registered_households' => (int) ($registered[$id] ?? 0),
        ])->values();

        $ai = $this->ai->score($facts);

        $rows = $facts->map(function ($f) use ($ai, $groups) {
            $alerts = $groups[$f['id']];

            return [
                'id' => $f['id'],
                'name' => $f['name'],
                'sos_count' => $f['sos_count'],
                'people' => $f['people_affected'],
                'waiting_minutes' => (int) $alerts->min('created_at')->diffInMinutes(now(), true),
                'score' => $ai[$f['id']]['score'] ?? $this->formula($alerts),
                'reason' => $ai[$f['id']]['reason'] ?? null,
            ];
        })->sortByDesc('score')->values();

        $top = max($rows->max('score') ?? 0, 1);
        $levels = config('relief.sos.levels');

        return [
            'engine' => $ai ? 'ai' : 'formula',
            'rows' => $rows->map(function ($row, $i) use ($top, $levels) {
                $ratio = $row['score'] / $top;

                return $row + [
                    'rank' => $i + 1,
                    'level' => $ratio >= $levels['critical'] ? 'critical' : ($ratio >= $levels['high'] ? 'high' : 'moderate'),
                ];
            }),
        ];
    }

    /** Fallback: each SOS counts more for bigger households and the longer it has waited. */
    private function formula(Collection $alerts): float
    {
        $max = config('relief.sos.waiting_max_hours');

        return round($alerts->sum(function ($a) use ($max) {
            $hours = $a->created_at->diffInMinutes(now(), true) / 60;

            return 10 * (1 + min($a->people_count, 10) / 10) * (1 + min($hours, $max) / $max * 0.5);
        }), 1);
    }
}
