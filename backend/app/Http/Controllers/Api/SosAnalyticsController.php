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

        return response()->json([
            'engine' => $engine, // 'ai' = calculated by Gemini, 'formula' = no API key or the call failed
            'summary' => [
                'active' => (clone $pending)->count(),
                'people' => (int) (clone $pending)->sum('people_count'),
                'barangays_asking' => $ranking->count(),
                'barangays_total' => Barangay::count(),
                'served' => SosAlert::where('status', 'served')->count(),
            ],
            'top' => $ranking->first(),
            'ranking' => $ranking,
            'timeline' => $timeline,
        ]);
    }

    /** Goods were delivered to this barangay: close its pending SOS so the ranking moves on. */
    public function serve(Barangay $barangay)
    {
        $count = SosAlert::where('barangay_id', $barangay->id)->where('status', 'pending')
            ->update(['status' => 'served', 'served_at' => now()]);

        return response()->json(['served' => $count]);
    }
}
