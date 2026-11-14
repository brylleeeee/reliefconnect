<?php

namespace Tests\Feature;

use App\Jobs\SendExpoPush;
use App\Models\User;
use App\Notifications\ResidentAlert;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Account → Notification Preferences: which notifications pop up on the phone.
 * Run with: php artisan test --filter=NotificationPreferencesTest
 */
class NotificationPreferencesTest extends TestCase
{
    use RefreshDatabase;

    private User $resident;

    protected function setUp(): void
    {
        parent::setUp();

        $this->resident = User::create(['name' => 'Resident', 'phone' => '09170000001', 'password' => 'Password123',
            'role' => User::ROLE_RESIDENT]);
        $this->resident->forceFill(['expo_push_token' => 'ExponentPushToken[abc123]'])->save();
    }

    private function save(bool $enabled, array $muted)
    {
        Sanctum::actingAs($this->resident);

        return $this->putJson('/api/me/notification-preferences', ['enabled' => $enabled, 'muted' => $muted]);
    }

    private function notify(string $kind): void
    {
        $this->resident->refresh()->notify(new ResidentAlert($kind, 'Title', 'Body', '/home'));
    }

    public function test_everything_is_on_by_default(): void
    {
        Sanctum::actingAs($this->resident);

        $this->getJson('/api/me/notification-preferences')
            ->assertOk()
            ->assertExactJson(['enabled' => true, 'muted' => []]);
    }

    public function test_preferences_are_saved_and_returned(): void
    {
        $this->save(true, ['announcements', 'sos'])->assertOk()
            ->assertExactJson(['enabled' => true, 'muted' => ['announcements', 'sos']]);

        $this->getJson('/api/me/notification-preferences')
            ->assertExactJson(['enabled' => true, 'muted' => ['announcements', 'sos']]);
    }

    public function test_unknown_categories_and_security_cannot_be_muted(): void
    {
        $this->save(true, ['security'])->assertStatus(422);
        $this->save(true, ['spam'])->assertStatus(422);
    }

    public function test_a_muted_type_is_not_pushed_but_still_reaches_the_bell(): void
    {
        Bus::fake();
        $this->save(true, ['distributions'])->assertOk();

        $this->notify('started');

        Bus::assertNotDispatched(SendExpoPush::class);
        $this->assertSame(1, $this->resident->notifications()->count());
    }

    public function test_other_types_are_still_pushed(): void
    {
        Bus::fake();
        $this->save(true, ['distributions'])->assertOk();

        $this->notify('released'); // "my household"

        Bus::assertDispatched(SendExpoPush::class);
    }

    public function test_turning_phone_notifications_off_stops_every_push_except_security(): void
    {
        Bus::fake();
        $this->save(false, [])->assertOk();

        $this->notify('schedule');
        $this->notify('sos_served');
        Bus::assertNotDispatched(SendExpoPush::class);

        $this->notify('security'); // new login on the account: always sent
        Bus::assertDispatchedTimes(SendExpoPush::class, 1);
    }

    public function test_preferences_need_a_login(): void
    {
        $this->getJson('/api/me/notification-preferences')->assertUnauthorized();
    }
}
