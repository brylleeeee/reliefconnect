<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiUsageLog;
use App\Services\AiUsage;
use App\Services\QueueHeartbeat;
use App\Services\SosMessageAnalyzer;

/**
 * LGU Admin: the AI status card. Is the AI working, how much of today's budget is left,
 * what went wrong last, and is the queue worker running?
 */
class AiStatusController extends Controller
{
    private const REASONS = [
        'no_key' => 'No AI key is set in the backend .env, so the rule-based engine scores SOS messages.',
        'cooldown' => 'The AI said "too many requests". It is paused for a minute; the rule-based engine fills in.',
        'request_budget' => 'Today\'s AI request budget is used up. The rule-based engine scores SOS messages until midnight.',
        'token_budget' => 'Today\'s AI token budget is used up. The rule-based engine scores SOS messages until midnight.',
    ];

    public function index(AiUsage $usage, QueueHeartbeat $heartbeat)
    {
        $blocked = $usage->blockedReason();
        $today = $usage->today();
        $budget = $usage->budget();
        $lastOk = AiUsageLog::where('outcome', 'ok')->latest('id')->first();
        $lastError = AiUsageLog::where('outcome', '!=', 'ok')->latest('id')->first();

        // Mostly failing lately even though nothing blocks it: tell the admin, the rules are covering
        $recent = AiUsageLog::latest('id')->limit(10)->pluck('outcome');
        $failing = ! $blocked && $recent->count() >= 3 && $recent->take(3)->every(fn ($o) => $o !== 'ok');

        return response()->json([
            'mode' => $blocked ? 'rules' : ($failing ? 'degraded' : 'ai'),
            'reason' => $blocked ? self::REASONS[$blocked] : ($failing
                ? 'The last AI requests failed. SOS messages are being scored by the rule-based engine until it answers again.'
                : null),
            'blocked' => $blocked,
            'models' => [
                'main' => config('services.gemini.model'),
                'backup' => config('services.gemini.fallback_model'),
            ],
            'today' => $today,
            'budget' => $budget + [
                'requests_left' => $budget['requests'] > 0 ? max(0, $budget['requests'] - $today['requests']) : null,
                'tokens_left' => $budget['tokens'] > 0 ? max(0, $budget['tokens'] - $today['tokens']) : null,
            ],
            'cooldown_until' => ($u = $usage->coolingDownUntil()) ? now()->setTimestamp($u)->toIso8601String() : null,
            'last_success_at' => $lastOk?->created_at,
            'last_error' => $lastError ? [
                'at' => $lastError->created_at,
                'model' => $lastError->model,
                'outcome' => $lastError->outcome,
                'http_status' => $lastError->http_status,
                'message' => $lastError->error,
            ] : null,
            'worker' => $heartbeat->status(),
        ]);
    }

    /** "Test connection": scores a sample message right now and reports what happened. */
    public function test(SosMessageAnalyzer $analyzer, AiUsage $usage)
    {
        if ($blocked = $usage->blockedReason()) {
            return response()->json(['ok' => false, 'message' => self::REASONS[$blocked]]);
        }

        $before = AiUsageLog::max('id') ?? 0;
        $started = microtime(true);
        $result = $analyzer->analyze('Baha na kami, hanggang tuhod na, may matanda at bata dito. Wala na kaming pagkain.', true, 'test');
        $attempts = AiUsageLog::where('id', '>', $before)->orderBy('id')->get(['model', 'outcome', 'http_status', 'duration_ms', 'error']);

        return response()->json([
            'ok' => $result['source'] === 'ai',
            'message' => $result['source'] === 'ai'
                ? 'The AI answered.'
                : 'The AI did not answer, so the rule-based engine scored the sample. See the attempts below.',
            'seconds' => round(microtime(true) - $started, 1),
            'result' => $result,
            'attempts' => $attempts,
        ]);
    }
}
