<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/** Is `php artisan queue:work` running, and how many SOS are waiting for it? Used by the AI status card. */
class QueueHeartbeat
{
    private const KEY = 'queue:worker_seen_at';

    /** The worker is considered stopped when it hasn't reported for this long. */
    public const STALE_SECONDS = 60;

    private int $lastWrite = 0;

    /** Called by the worker on every loop (every few seconds); written at most every 15 seconds. */
    public function beat(): void
    {
        if (time() - $this->lastWrite < 15) {
            return;
        }
        $this->lastWrite = time();
        Cache::put(self::KEY, time(), 3600);
    }

    public function status(): array
    {
        $seen = Cache::get(self::KEY);
        $waiting = DB::table('jobs')->where('queue', 'sos');
        $oldest = (clone $waiting)->min('created_at');

        return [
            'running' => $seen !== null && time() - $seen <= self::STALE_SECONDS,
            'last_seen_at' => $seen ? now()->setTimestamp($seen)->toIso8601String() : null,
            'queued_sos' => (clone $waiting)->count(),
            'oldest_waiting_seconds' => $oldest ? max(0, time() - (int) $oldest) : null,
        ];
    }
}
