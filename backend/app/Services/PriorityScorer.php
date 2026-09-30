<?php

namespace App\Services;

use App\Models\Household;

/**
 * Computes a household's vulnerability counts and priority score from its members,
 * using the rules in config/relief.php. Same input always gives the same result.
 */
class PriorityScorer
{
    public function apply(Household $household): void
    {
        $cfg = config('relief');
        $w = $cfg['priority_weights'];
        $members = $household->members;

        $seniors = $members->filter(fn ($m) => $m->age >= $cfg['senior_age'])->count();
        $infants = $members->filter(fn ($m) => $m->age <= $cfg['infant_max_age'])->count();
        $pwd = $members->where('is_pwd', true)->count();
        $pregnant = $members->where('is_pregnant', true)->count();
        $size = $members->count();

        $score = $seniors * $w['senior']
            + $pwd * $w['pwd']
            + $pregnant * $w['pregnant']
            + $infants * $w['infant']
            + ($household->is_solo_parent ? $w['solo_parent'] : 0)
            + ($size >= $cfg['large_household_size'] ? $w['large_household'] : 0);

        $level = match (true) {
            $score >= $cfg['priority_levels']['high'] => 'high',
            $score >= $cfg['priority_levels']['medium'] => 'medium',
            default => 'low',
        };

        $household->fill([
            'members_count' => $size,
            'seniors_count' => $seniors,
            'infants_count' => $infants,
            'pwd_count' => $pwd,
            'pregnant_count' => $pregnant,
            'priority_score' => $score,
            'priority_level' => $level,
        ]);
    }
}
