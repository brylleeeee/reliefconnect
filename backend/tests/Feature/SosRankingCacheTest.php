
<?php

namespace Tests\Feature;

use App\Jobs\ScoreSosAlert;
use App\Models\Barangay;
use App\Models\Household;
use App\Models\SosAlert;
use App\Models\User;
use App\Services\SosMessageAnalyzer;
use App\Services\SosPrioritizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Always-ready SOS ranking: cached, rebuilt only when something changes, with freshness info.
 * Run with: php artisan test --filter=SosRankingCacheTest
 */
class SosRankingCacheTest extends TestCase
{
    use RefreshDatabase;

    private Barangay $brgy;

    protected function setUp(): void
    {
        parent::setUp();
        $this->brgy = Barangay::create(['name' => 'Malaca']);
        Sanctum::actingAs(User::create(['name' => 'LGU', 'email' => 'lgu@test.local', 'password' => 'Password123', 'role' => User::ROLE_MUNICIPAL_ADMIN]));
    }

    private function sos(string $message = 'baha na kami'): SosAlert
    {
        $h = Household::forceCreate(['barangay_id' => $this->brgy->id, 'household_head' => 'H'.uniqid(), 'status' => 'approved']);
        $sos = SosAlert::create(['household_id' => $h->id, 'barangay_id' => $this->brgy->id, 'people_count' => 2, 'message' => $message]);
        app(SosMessageAnalyzer::class)->scoreAlert($sos, useAi: false);

        return $sos;
    }

    public function test_ranking_is_reused_until_something_changes(): void
    {
        $this->sos();
        $first = app(SosPrioritizer::class)->rank();

        Carbon::setTestNow(now()->addSeconds(5));
        $this->assertSame($first['computed_at'], app(SosPrioritizer::class)->rank()['computed_at']); // cached

        $this->sos(); // a new SOS: rebuilt at once, even within the same minute
        $again = app(SosPrioritizer::class)->rank();
        $this->assertNotSame($first['computed_at'], $again['computed_at']);
        $this->assertSame(2, $again['rows'][0]['sos_count']);

        Carbon::setTestNow(now()->addSeconds(61)); // waiting time moved on: rebuilt after a minute
        $this->assertNotSame($again['computed_at'], app(SosPrioritizer::class)->rank()['computed_at']);
    }

    public function test_serving_a_barangay_clears_it_from_the_cached_ranking(): void
    {
        $this->sos();
        $this->getJson('/api/admin/sos')->assertJsonCount(1, 'ranking');

        $this->postJson("/api/admin/sos/barangays/{$this->brgy->id}/serve")->assertOk(); // bulk update, no model events
        $this->getJson('/api/admin/sos')->assertJsonCount(0, 'ranking');
    }

    public function test_shows_sos_still_being_analyzed_until_the_ai_answers(): void
    {
        Queue::fake();
        config(['services.gemini.key' => 'test-key']);
        $sos = $this->sos();
        ScoreSosAlert::queueFor($sos);

        $this->getJson('/api/admin/sos')->assertOk()
            ->assertJsonPath('freshness.analyzing', 1)
            ->assertJsonPath('ranking.0.analyzing', 1);

        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode(
            ['category' => 'flood', 'severity' => 10, 'flags' => ['trapped'], 'reason' => 'Trapped by flood.'],
        )]]]]]])]);
        (new ScoreSosAlert($sos->id, md5($sos->message)))->handle(app(SosMessageAnalyzer::class));

        $this->getJson('/api/admin/sos')->assertOk()
            ->assertJsonPath('freshness.analyzing', 0)
            ->assertJsonPath('engine', 'ai')
            ->assertJsonPath('top.reason', 'Trapped by flood.');
    }
}
