<?php

namespace Tests\Feature;

use App\Models\AiUsageLog;
use App\Models\User;
use App\Services\QueueHeartbeat;
use App\Services\SosMessageAnalyzer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * AI status card (adviser: always show the admin the available AI tokens).
 * Run with: php artisan test --filter=AiStatusTest
 */
class AiStatusTest extends TestCase
{
    use RefreshDatabase;

    private const URL = 'generativelanguage.googleapis.com/*';

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.gemini.key' => 'test-key', 'services.gemini.model' => 'main-model',
            'services.gemini.fallback_model' => 'backup-model', 'services.gemini.daily_requests' => 3,
            'services.gemini.daily_tokens' => 0,
        ]);
        Sanctum::actingAs(User::create(['name' => 'LGU', 'email' => 'lgu@test.local', 'password' => 'Password123', 'role' => User::ROLE_MUNICIPAL_ADMIN]));
    }

    private function ok(int $tokens = 120): array
    {
        return [
            'candidates' => [['content' => ['parts' => [['text' => json_encode(['category' => 'flood', 'severity' => 7, 'flags' => [], 'reason' => 'Flood.'])]]]]],
            'usageMetadata' => ['promptTokenCount' => $tokens - 20, 'candidatesTokenCount' => 20, 'totalTokenCount' => $tokens],
        ];
    }

    public function test_counts_requests_and_tokens_against_the_daily_budget(): void
    {
        Http::fake([self::URL => Http::response($this->ok(150))]);
        app(SosMessageAnalyzer::class)->analyze('baha na kami');

        $this->getJson('/api/admin/ai-status')->assertOk()
            ->assertJsonPath('mode', 'ai')
            ->assertJsonPath('today.requests', 1)
            ->assertJsonPath('today.ok', 1)
            ->assertJsonPath('today.tokens', 150)
            ->assertJsonPath('budget.requests_left', 2)
            ->assertJsonPath('models.backup', 'backup-model');
    }

    public function test_budget_used_up_switches_to_the_rules_without_calling_the_ai(): void
    {
        Http::fake([self::URL => Http::response($this->ok())]);
        foreach (range(1, 3) as $i) {
            app(SosMessageAnalyzer::class)->analyze("baha {$i}");
        }

        $r = app(SosMessageAnalyzer::class)->analyze('baha na kami');
        $this->assertSame('rules', $r['source']);
        Http::assertSentCount(3);

        $this->getJson('/api/admin/ai-status')
            ->assertJsonPath('mode', 'rules')
            ->assertJsonPath('blocked', 'request_budget')
            ->assertJsonPath('budget.requests_left', 0);
    }

    public function test_rate_limit_on_every_model_pauses_the_ai_briefly(): void
    {
        Http::fake([self::URL => Http::response(['error' => ['message' => 'Resource exhausted']], 429)]);
        app(SosMessageAnalyzer::class)->analyze('baha na kami');
        Http::assertSentCount(2); // main, then backup

        app(SosMessageAnalyzer::class)->analyze('baha ulit');
        Http::assertSentCount(2); // paused: no new request

        $this->getJson('/api/admin/ai-status')
            ->assertJsonPath('blocked', 'cooldown')
            ->assertJsonPath('last_error.http_status', 429)
            ->assertJsonPath('last_error.message', 'Resource exhausted');
        $this->assertSame(2, AiUsageLog::where('outcome', 'busy')->count());
    }

    public function test_no_key_and_worker_status(): void
    {
        config(['services.gemini.key' => null]);
        $this->getJson('/api/admin/ai-status')
            ->assertJsonPath('mode', 'rules')
            ->assertJsonPath('blocked', 'no_key')
            ->assertJsonPath('worker.running', false);

        app(QueueHeartbeat::class)->beat();
        DB::table('jobs')->insert(['queue' => 'sos', 'payload' => '{}', 'attempts' => 0, 'available_at' => time(), 'created_at' => time() - 30]);

        $this->getJson('/api/admin/ai-status')
            ->assertJsonPath('worker.running', true)
            ->assertJsonPath('worker.queued_sos', 1);
    }

    public function test_test_connection_reports_the_attempts(): void
    {
        Http::fake([
            '*main-model*' => Http::response('overloaded', 503),
            '*backup-model*' => Http::response($this->ok()),
        ]);

        $this->postJson('/api/admin/ai-status/test')->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('result.source', 'ai')
            ->assertJsonPath('attempts.0.outcome', 'busy')
            ->assertJsonPath('attempts.1.outcome', 'ok')
            ->assertJsonPath('attempts.1.model', 'backup-model');
        $this->assertSame(2, AiUsageLog::where('purpose', 'test')->count());
    }
}
