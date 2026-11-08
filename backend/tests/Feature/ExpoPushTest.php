<?php

namespace Tests\Feature;

use App\Jobs\SendExpoPush;
use App\Models\User;
use App\Notifications\Channels\ExpoPushChannel;
use App\Notifications\ResidentAlert;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Push notifications (phone notification bar, even when the app is closed).
 * Run with: php artisan test --filter=ExpoPushTest
 */
class ExpoPushTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'ExponentPushToken[abc123]';

    private function resident(?string $token = self::TOKEN): User
    {
        $u = User::create(['name' => 'Resident', 'phone' => '09170000001', 'password' => 'Password123', 'role' => User::ROLE_RESIDENT]);
        $u->forceFill(['expo_push_token' => $token])->save();

        return $u;
    }

    public function test_channel_queues_a_push_when_the_user_has_a_token(): void
    {
        Bus::fake();
        $user = $this->resident();

        (new ExpoPushChannel)->send($user, new ResidentAlert('schedule', 'Title', 'Body', '/home'));

        Bus::assertDispatched(SendExpoPush::class, fn ($job) => $job->userId === $user->id && $job->message['title'] === 'Title');
    }

    public function test_channel_skips_users_without_a_token(): void
    {
        Bus::fake();

        (new ExpoPushChannel)->send($this->resident(null), new ResidentAlert('schedule', 'Title', 'Body', '/home'));

        Bus::assertNothingDispatched();
    }

    public function test_job_posts_to_expo_with_sound_and_channel(): void
    {
        Http::fake(['exp.host/*' => Http::response(['data' => ['status' => 'ok', 'id' => 'x']])]);
        $user = $this->resident();

        SendExpoPush::dispatchSync($user->id, (new ResidentAlert('started', 'Hello', 'World', '/home'))->toExpoPush($user));

        Http::assertSent(fn ($req) => $req->url() === 'https://exp.host/--/api/v2/push/send'
            && $req['to'] === self::TOKEN
            && $req['sound'] === 'default'
            && $req['channelId'] === 'default'
            && $req['priority'] === 'high'
            && $req['title'] === 'Hello'
            && $req['data']['link'] === '/home');
    }

    public function test_job_clears_a_dead_token(): void
    {
        Http::fake(['exp.host/*' => Http::response(['data' => [
            'status' => 'error', 'message' => 'not registered', 'details' => ['error' => 'DeviceNotRegistered'],
        ]])]);
        $user = $this->resident();

        SendExpoPush::dispatchSync($user->id, ['title' => 'T', 'body' => 'B']);

        $this->assertNull($user->fresh()->expo_push_token);
    }

    public function test_a_resident_notification_reaches_the_queue_end_to_end(): void
    {
        Bus::fake();
        $user = $this->resident();

        $user->notify(new ResidentAlert('approved', 'Household approved', 'QR ready', '/home'));

        Bus::assertDispatched(SendExpoPush::class);
        $this->assertDatabaseCount('notifications', 1); // the bell still works
    }
}
