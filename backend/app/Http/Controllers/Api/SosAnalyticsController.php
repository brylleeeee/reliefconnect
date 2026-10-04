<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Barangay;
use App\Models\SosAlert;
use App\Services\SosPrioritizer;

/** LGU Admin: which barangay needs relief goods first, ranked from incoming SOS. */
class SosAnalyticsController extends Controller
{
    public function index(SosPrioritizer $prioritizer)
    {
        ['engine' => $engine, 'rows' => $ranking] = $prioritizer->rank();
        $pending = SosAlert::where('status', 'pending');

        // New SOS per hour for the last 24 hours (all statuses, so served ones still show the surge)
        $since = now()->subHours(23)->startOfHour();
        $recent = SosAlert::where('created_at', '>=', $since)->get(['created_at'])->pluck('created_at');
        $timeline = collect(range(0, 23))->map(function ($i) use ($since, $recent) {
            $from = $since->copy()->addHours($i);

            return [
                'hour' => $from->format('ga'),
                'count' => $recent->filter(fn ($t) => $t >= $from && $t < $from->copy()->addHour())->count(),
            ];
        })->values();

        // Bar-graph data (new): every chart is a bar chart with the same barangay labels
        $labels = $ranking->pluck('name')->all();
        $types = (clone $pending)
            ->selectRaw("COALESCE(ai_category, 'unclassified') as type, COUNT(*) as total")
            ->groupBy('type')
            ->orderByDesc('total')
            ->pluck('total', 'type');

        return response()->json([
            'engine' => $engine, // 'ai' = every SOS message read by Gemini, 'mixed' = some used the keyword fallback, 'formula' = no AI used
            'summary' => [
                'active' => (clone $pending)->count(),
                'people' => (int) (clone $pending)->sum('people_count'),
                'barangays_asking' => $ranking->count(),
                'barangays_total' => Barangay::count(),
                'served' => SosAlert::where('status', 'served')->count(),
                'ai_points' => (int) $ranking->sum('ai_points'),
                'vulnerability_points' => (int) $ranking->sum('vulnerability_points'),
            ],
            'top' => $ranking->first(),
            'ranking' => $ranking,
            'timeline' => $timeline,
            'charts' => [
                'priority_score' => ['labels' => $labels, 'data' => $ranking->pluck('score')->all()],
                'score_breakdown' => [
                    'labels' => $labels,
                    'base' => $ranking->pluck('base_score')->all(),
                    'ai_points' => $ranking->pluck('ai_points')->all(),
                    'vulnerability' => $ranking->pluck('vulnerability_points')->all(),
                ],
                'sos_count' => ['labels' => $labels, 'data' => $ranking->pluck('sos_count')->all()],
                'people_affected' => ['labels' => $labels, 'data' => $ranking->pluck('people')->all()],
                'longest_wait_hours' => [
                    'labels' => $labels,
                    'data' => $ranking->map(fn ($r) => round($r['waiting_minutes'] / 60, 1))->all(),
                ],
                'emergency_types' => ['labels' => $types->keys()->all(), 'data' => $types->values()->all()],
            ],
        ]);
    }

    /** Goods were delivered to this barangay: close its pending SOS so the ranking moves on. */
    public function serve(Barangay $barangay)
    {
        $pending = SosAlert::where('barangay_id', $barangay->id)->where('status', 'pending');
        $householdIds = (clone $pending)->whereNotNull('household_id')->pluck('household_id')->unique()->values()->all();
        $count = $pending->update(['status' => 'served', 'served_at' => now()]);

        app(\App\Services\ResidentNotifier::class)->sosServed($householdIds, $barangay->name); // bell: "Relief is on the way"

        return response()->json(['served' => $count]);
    }
}
