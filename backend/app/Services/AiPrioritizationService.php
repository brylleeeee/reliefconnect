<?php

namespace App\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Asks Gemini to score each barangay (0-100) from its SOS facts.
 * Returns null when there is no API key or the call fails, so the caller can use the plain formula instead.
 */
class AiPrioritizationService
{
    private const SYSTEM = <<<'TXT'
You help the LGU of Urbiztondo, Pangasinan decide which barangay should receive relief goods first.
Every SOS is one household in that barangay asking for relief goods (food, water, hygiene kits, blankets).
For each barangay you get: sos_count (households asking), people_affected, longest_wait_minutes (the oldest
unanswered SOS), new_sos_last_hour (recent surge), and registered_households (so you can judge what share of
the barangay is asking).
Score each barangay from 0 to 100, where 100 is the most urgent. Weigh the number of people affected and the
share of households asking most, then long waiting times, then a recent surge. Do not invent facts.
Reply with ONLY a JSON array, no other text, one item per barangay:
[{"id": <barangay id>, "score": <0-100>, "reason": "<plain English, at most 15 words>"}]
TXT;

    public function enabled(): bool
    {
        return filled(config('services.gemini.key'));
    }

    /**
     * @param  Collection<int, array>  $facts  one row per barangay
     * @return array<int, array{score: float, reason: string}>|null  keyed by barangay id
     */
    public function score(Collection $facts): ?array
    {
        if (! $this->enabled() || $facts->isEmpty()) {
            return null;
        }

        // Same facts give the same answer without calling the API again (the dashboard refreshes every 10s)
        $key = 'sos-ai:'.md5($facts->toJson());
        $cached = Cache::get($key);
        if ($cached !== null) {
            return $cached ?: null;
        }

        $result = $this->ask($facts);
        Cache::put($key, $result ?? false, $result ? now()->addMinutes(config('relief.sos.ai_cache_minutes')) : now()->addMinute());

        return $result;
    }

    private function ask(Collection $facts): ?array
    {
        try {
            $model = config('services.gemini.model');
            $res = Http::withHeaders(['x-goog-api-key' => config('services.gemini.key')])
                ->timeout(30)
                ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent", [
                    'systemInstruction' => ['parts' => [['text' => self::SYSTEM]]],
                    'contents' => [['role' => 'user', 'parts' => [['text' => $facts->values()->toJson()]]]],
                    'generationConfig' => ['temperature' => 0, 'responseMimeType' => 'application/json'],
                ]);

            if (! $res->successful()) {
                Log::warning('SOS AI (Gemini) call failed', ['status' => $res->status(), 'body' => $res->body()]);

                return null;
            }

            $text = collect($res->json('candidates.0.content.parts'))->reject(fn ($p) => ! empty($p['thought']))
                ->pluck('text')->implode('');
            $text = trim(preg_replace('/^```(?:json)?\s*|\s*```$/', '', trim($text)));
            $items = collect(json_decode($text, true) ?: [])
                ->filter(fn ($i) => is_array($i) && isset($i['id'], $i['score']) && is_numeric($i['score']))
                ->keyBy('id');

            // Use the answer only if it covers every barangay we asked about
            if ($facts->pluck('id')->contains(fn ($id) => ! $items->has($id))) {
                Log::warning('SOS AI answer was incomplete', ['text' => $text]);

                return null;
            }

            return $items->map(fn ($i) => [
                'score' => round(max(0, min(100, (float) $i['score'])), 1),
                'reason' => (string) ($i['reason'] ?? ''),
            ])->all();
        } catch (\Throwable $e) {
            Log::warning('SOS AI call error: '.$e->getMessage());

            return null;
        }
    }
}
