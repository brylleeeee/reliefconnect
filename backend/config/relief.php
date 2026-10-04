<?php

/*
| Priority scoring rules for ReliefConnect.
| Kept in one file so the LGU can adjust weights without touching code,
| and so the scoring is transparent and explainable (no human discretion).
*/

return [

    // Points added to a household's priority score
    'priority_weights' => [
        'senior' => 3,          // each member aged 60+
        'pwd' => 3,             // each person with disability
        'pregnant' => 3,        // each pregnant member
        'infant' => 2,          // each member under 2 years old
        'solo_parent' => 2,     // household headed by a solo parent
        'large_household' => 2, // household with 6 or more members
    ],

    'senior_age' => 60,
    'infant_max_age' => 1,      // age 0–1 counts as infant
    'large_household_size' => 6,

    // Score thresholds for the three priority levels
    'priority_levels' => [
        'high' => 8,   // score >= 8
        'medium' => 4, // score 4–7, anything lower is "low"
    ],

    // How much each level counts when splitting relief packs across barangays
    'allocation_weights' => [
        'high' => 3,
        'medium' => 2,
        'low' => 1,
    ],

    // Units offered in "Log Incoming Stock" (plural form is stored; singular is shown for 1).
    'units' => [
        'Packs' => 'Pack', 'Kits' => 'Kit', 'Pieces' => 'Piece', 'Kilos' => 'Kilo',
        'Sacks' => 'Sack', 'Bags' => 'Bag', 'Boxes' => 'Box', 'Sets' => 'Set',
        'Bottles' => 'Bottle', 'Cans' => 'Can', 'Liters' => 'Liter', 'Carboys' => 'Carboy',
    ],

    // Cash aid is tracked like stock, in whole pesos, but kept separate from relief goods.
    'cash_unit' => 'PHP',

    // ---- SOS prioritization (which barangay gets relief goods first) ----
    // An SOS from a resident always means "we need relief goods". Gemini ranks the barangays from the SOS
    // facts (count, people, waiting time, recent surge). This is separate from household vulnerability scoring.
    'sos' => [
        'levels' => ['critical' => 0.7, 'high' => 0.4], // share of the top barangay's score
        'waiting_max_hours' => 24,                       // used by the fallback formula
        'ai_cache_minutes' => 10,                        // same facts = same answer, no repeat API call
        // Aid Prioritization: each active SOS from an approved household adds this much to its
        // barangay's demand (same as one high-priority household), so asking barangays get more packs.
        'allocation_points' => 3,
    ],

];
