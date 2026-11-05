<?php

namespace Tests\Feature;

use App\Jobs\ScoreSosAlert;
use App\Models\Barangay;
use App\Models\Household;
use App\Models\SosAlert;
use App\Models\User;
use App\Services\SosMessageAnalyzer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * SOS AI scoring in the background (adviser: Laravel jobs and queues, AI always ready).
 * Run with: php artisan test --filter=SosAiQueueTest
 */
class SosAiQueueTest extends TestCase
{
    use RefreshDatabase;

    private const URL = 'generativelanguage.googleapis.com/*';

    private User $resident;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.gemini.key' => 'test-key', 'services.gemini.model' => 'main-model', 'services.gemini.fallback_model' => 'backup-model']);

        $brgy = Barangay::create(['name' => 'Malaca']);
        $this->resident = User::create(['name' => 'Res', 'phone' => '09170000011', 'password' => 'Password123', 'role' => User::ROLE_RESIDENT]);
        Household::forceCreate(['user_id' => $this->resident->id, 'barangay_id' => $brgy->id, 'household_head' => 'Res', 'status' => 'approved', 'members_count' => 4]);
    }

    /** What Gemini returns: one JSON object as text. */
    private function aiAnswer(int $severity = 10, string $reason = 'Chest-deep flood with trapped elderly.'): array
    {
        return ['candidates' => [['content' => ['parts' => [['text' => json_encode([
            'category' => 'flood', 'severity' => $severity, 'flags' => ['trapped', 'elderly'], 'reason' => $reason,
        ])]]]]]];
    }

    private function sendSos(string $message = 'baha na kami, hanggang dibdib na, may matanda dito')
    {
        Sanctum::actingAs($this->resident);

        return $this->postJson('/api/resident/sos', ['message' => $message]);
    }

    public function test_sos_is_scored_instantly_and_the_ai_job_goes_on_the_sos_queue(): void
    {
        Queue::fake();
        Http::fake(); // the request itself must not call the AI

        $this->sendSos()->assertCreated()
            ->assertJsonPath('sos.ai_source', 'rules')
            ->assertJsonPath('sos.ai_status', 'queued');

        $this->assertGreaterThan(0, SosAlert::first()->ai_points); // counts in the ranking right away
        Http::assertNothingSent();
        Queue::assertPushedOn('sos', ScoreSosAlert::class);
    }

    public function test_without_a_key_or_message_no_job_is_queued(): void
    {
        Queue::fake();
        config(['services.gemini.key' => null]);
        $this->sendSos()->assertCreated()->assertJsonPath('sos.ai_status', null);
        Queue::assertNothingPushed();

        config(['services.gemini.key' => 'test-key']);
        SosAlert::query()->delete();
        $this->sendSos('')->assertCreated();
        Queue::assertNothingPushed();
    }

    public function test_job_replaces_the_rules_score_with_the_ai_score(): void
    {
        Queue::fake();
        $this->sendSos();
        $alert = SosAlert::first();

        Http::fake([self::URL => Http::response($this->aiAnswer())]);
        (new ScoreSosAlert($alert->id, md5($alert->message)))->handle(app(SosMessageAnalyzer::class));

        $alert->refresh();
        $this->assertSame('ai', $alert->ai_source);
        $this->assertSame('done', $alert->ai_status);
        $this->assertSame('Chest-deep flood with trapped elderly.', $alert->ai_reason);
    }

    public function test_busy_main_model_falls_back_to_the_backup_model(): void
    {
        Http::fake([
            '*main-model*' => Http::response(['error' => ['message' => 'overloaded']], 503),
            '*backup-model*' => Http::response($this->aiAnswer(8, 'Answered by the backup model.')),
        ]);

        $r = app(SosMessageAnalyzer::class)->analyze('baha na kami');
        $this->assertSame('ai', $r['source']);
        $this->assertSame('Answered by the backup model.', $r['reason']);
        Http::assertSentCount(2);
    }

    public function test_wrong_key_does_not_try_the_backup_and_keeps_the_rules_score(): void
    {
        Queue::fake();
        $this->sendSos();
        $alert = SosAlert::first();
        $rulesPoints = $alert->ai_points;

        Http::fake([self::URL => Http::response(['error' => ['message' => 'API key not valid']], 400)]);
        (new ScoreSosAlert($alert->id, md5($alert->message)))->handle(app(SosMessageAnalyzer::class));

        Http::assertSentCount(1);
        $alert->refresh();
        $this->assertSame('fallback', $alert->ai_status);
        $this->assertSame('rules', $alert->ai_source);
        $this->assertSame($rulesPoints, $alert->ai_points);
    }

    public function test_both_models_down_keeps_the_rules_score(): void
    {
        Http::fake([self::URL => Http::response('busy', 503)]);
        $r = app(SosMessageAnalyzer::class)->analyze('baha na kami, may matanda');
        $this->assertSame('rules', $r['source']);
        $this->assertSame('flood', $r['category']);
    }

    public function test_job_for_an_older_message_or_withdrawn_sos_does_nothing(): void
    {
        Queue::fake();
        $this->sendSos('baha na kami');
        $alert = SosAlert::first();
        $oldHash = md5($alert->message);

        // The resident adds to the message: a newer job is queued; the old one must not overwrite it
        $this->sendSos('may matanda na hindi makalabas')->assertOk();
        Queue::assertPushed(ScoreSosAlert::class, 2);

        Http::fake([self::URL => Http::response($this->aiAnswer())]);
        (new ScoreSosAlert($alert->id, $oldHash))->handle(app(SosMessageAnalyzer::class));
        Http::assertNothingSent();
        $this->assertSame('queued', $alert->fresh()->ai_status);

        $alert->update(['status' => 'cancelled']);
        (new ScoreSosAlert($alert->id, md5($alert->fresh()->message)))->handle(app(SosMessageAnalyzer::class));
        Http::assertNothingSent();
    }
}
