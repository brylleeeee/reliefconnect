<?php

namespace App\Services;

use App\Models\Household;

/**
 * Computes a household's vulnerability counts and priority score from its members,
 * using the rules in config/relief.php. Same input always gives the same result.
 *
 * Members still listed in another household (waiting for the barangay to approve their move) are not
 * counted yet, so one person never adds points to two households.
 */
class PriorityScorer
{
    public function apply(Household $household): void
    {
        $cfg = config('relief');
        $w = $cfg['priority_weights'];
        $members = $household->members->whereNull('transfer_from_household_id');

        $seniors = $members->filter(fn ($m) => $m->age >= $cfg['senior_age'])->count();
        $infants = $members->filter(fn ($m) => $m->age <= $cfg['infant_max_age'])->count();
        $pwd = $members->where('is_pwd', true)->count();
        $pregnant = $members->where('is_pregnant', true)->count();
        $size = $members->count();

        // Nobody aged 18-59 without a disability: seniors living alone, a PWD alone, children alone
        $ableBodied = $members->filter(fn ($m) => $m->age >= $cfg['adult_age'] && $m->age < $cfg['senior_age'] && ! $m->is_pwd)->count();
        $needsAssistance = $size > 0 && $ableBodied === 0;

        $score = $seniors * $w['senior']
            + $pwd * $w['pwd']
            + $pregnant * $w['pregnant']
            + $infants * $w['infant']
            + ($household->is_solo_parent ? $w['solo_parent'] : 0)
            + ($size >= $cfg['large_household_size'] ? $w['large_household'] : 0)
            + ($needsAssistance ? $w['no_able_bodied_adult'] : 0);

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
            'needs_assistance' => $needsAssistance,
        ]);
    }
}
