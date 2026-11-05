<?php

namespace App\Services;

use App\Models\AiUsageLog;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Counts what ReliefConnect sends to the AI and enforces the daily budget from .env.
 *
 * Google doesn't report how much free quota is left, so "available tokens" here means:
 * the budget set in GEMINI_DAILY_REQUESTS / GEMINI_DAILY_TOKENS minus what was used today (Philippine time).
 * When the budget runs out, or every model said "too many requests", the AI pauses and the built-in
 * rules score SOS messages instead. Nothing stops working.
 */
class AiUsage
{
    /** After every model answered 429 (rate limit), skip the AI for this many seconds. */
    public const COOLDOWN_SECONDS = 60;

    private const COOLDOWN_KEY = 'ai:cooldown_until';

    public function record(string $model, string $purpose, string $outcome, ?Response $res, int $ms, ?string $error = null): void
    {
        $usage = $res?->json('usageMetadata') ?? [];

        AiUsageLog::create([
            'model' => mb_substr($model, 0, 64),
            'purpose' => $purpose,
            'outcome' => $outcome,
            'http_status' => $res?->status(),
            'prompt_tokens' => (int) ($usage['promptTokenCount'] ?? 0),
            'output_tokens' => (int) ($usage['candidatesTokenCount'] ?? 0) + (int) ($usage['thoughtsTokenCount'] ?? 0),
            'total_tokens' => (int) ($usage['totalTokenCount'] ?? 0),
            'duration_ms' => $ms,
            'error' => $error ? mb_substr($error, 0, 255) : null,
        ]);
    }

    /** Why the AI may not be used right now, or null when it may. */
    public function blockedReason(): ?string
    {
        if (blank(config('services.gemini.key'))) {
            return 'no_key';
        }
        if ($this->coolingDownUntil()) {
            return 'cooldown';
        }
        $today = $this->today();
        $budget = $this->budget();
        if ($budget['requests'] > 0 && $today['requests'] >= $budget['requests']) {
            return 'request_budget';
        }
        if ($budget['tokens'] > 0 && $today['tokens'] >= $budget['tokens']) {
            return 'token_budget';
        }

        return null;
    }

    public function startCooldown(): void
    {
        Cache::put(self::COOLDOWN_KEY, now()->addSeconds(self::COOLDOWN_SECONDS)->timestamp, self::COOLDOWN_SECONDS);
    }

    public function coolingDownUntil(): ?int
    {
        $until = Cache::get(self::COOLDOWN_KEY);

        return $until && $until > now()->timestamp ? (int) $until : null;
    }

    /** @return array{requests: int, tokens: int} 0 = no limit */
    public function budget(): array
    {
        return [
            'requests' => (int) config('services.gemini.daily_requests', 0),
            'tokens' => (int) config('services.gemini.daily_tokens', 0),
        ];
    }

    /** Totals for today, Philippine time. */
    public function today(): array
    {
        $row = DB::table('ai_usage_logs')->where('created_at', '>=', now()->startOfDay())
            ->selectRaw("COUNT(*) AS requests,
                SUM(CASE WHEN outcome = 'ok' THEN 1 ELSE 0 END) AS ok,
                COALESCE(SUM(total_tokens), 0) AS tokens,
                COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
                COALESCE(SUM(output_tokens), 0) AS output_tokens,
                AVG(CASE WHEN outcome = 'ok' THEN duration_ms END) AS avg_ms")
            ->first();

        return [
            'requests' => (int) $row->requests,
            'ok' => (int) $row->ok,
            'failed' => (int) $row->requests - (int) $row->ok,
            'tokens' => (int) $row->tokens,
            'prompt_tokens' => (int) $row->prompt_tokens,
            'output_tokens' => (int) $row->output_tokens,
            'avg_ms' => $row->avg_ms !== null ? (int) round($row->avg_ms) : null,
        ];
    }
}
