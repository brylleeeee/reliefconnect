<?php

namespace App\Jobs;

use App\Models\SosAlert;
use App\Services\SosMessageAnalyzer;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Background AI scoring of one SOS message.
 *
 * The SOS is saved and scored with the built-in rules right away, so the resident never waits and the
 * SOS counts in the ranking immediately. This job then asks the AI for a better reading of the message
 * and replaces the rules score. It runs on the "sos" queue, which the worker always takes first:
 *
 *     php artisan queue:work --queue=sos,default
 *
 * If the AI can't be reached (no internet, model busy, daily limit), the rules score simply stays.
 */
class ScoreSosAlert implements ShouldQueue
{
    use Queueable;

    /** The analyzer already tries the main model, then the backup; one attempt of the job is enough. */
    public int $tries = 1;

    /** Seconds before the worker gives up on this job (two model attempts plus margin). */
    public int $timeout = 120;

    /**
     * @param  string  $messageHash  md5 of the message when queued: if the resident adds to the message
     *                               before this runs, a newer job scores the full text and this one stops.
     */
    public function __construct(public int $sosAlertId, public string $messageHash)
    {
        $this->onQueue('sos');
    }

    public static function queueFor(SosAlert $alert): void
    {
        $alert->forceFill(['ai_status' => 'queued'])->save();
        self::dispatch($alert->id, md5((string) $alert->message));
    }

    public function handle(SosMessageAnalyzer $analyzer): void
    {
        $alert = SosAlert::find($this->sosAlertId);

        // Withdrawn, served, or edited since: nothing to do (a newer job covers an edit)
        if (! $alert || $alert->status !== 'pending' || md5((string) $alert->message) !== $this->messageHash) {
            return;
        }

        $result = $analyzer->analyze((string) $alert->message);

        if ($result['source'] === 'ai') {
            $analyzer->save($alert, $result, 'done');
        } else {
            // The AI failed: keep the rules score already on the SOS, just record that AI wasn't used
            $alert->forceFill(['ai_status' => 'fallback'])->save();
        }
    }

    /** Timed out or crashed: the SOS keeps its rules score. */
    public function failed(?Throwable $e): void
    {
        SosAlert::whereKey($this->sosAlertId)->where('ai_status', 'queued')->update(['ai_status' => 'fallback']);
    }
}
