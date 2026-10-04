<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\BarangayDistribution;
use App\Models\DistributionEvent;
use App\Models\Household;
use App\Models\ReliefItem;
use App\Models\User;
use App\Services\DistributionEventService;
use App\Services\HouseholdService;
use App\Services\ResidentNotifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * In-app notifications (bell icon) for residents.
 * Run with: php artisan test --filter=NotificationsTest
 */
class NotificationsTest extends TestCase
{
    use RefreshDatabase;

    private Barangay $barangay;
    private User $admin;
    private User $resident;
    private User $neighbor;
    private User $outsider;
    private Household $household;

    protected function setUp(): void
    {
        parent::setUp();

        $this->barangay = Barangay::create(['name' => 'Batangcaoa']);
        $other = Barangay::create(['name' => 'Poblacion']);
        $this->admin = User::create(['name' => 'Brgy Admin', 'email' => 'admin@test.local', 'password' => 'Password123',
            'role' => User::ROLE_BARANGAY_ADMIN, 'barangay_id' => $this->barangay->id]);

        $resident = fn (string $phone) => User::create(['name' => $phone, 'phone' => $phone, 'password' => 'Password123', 'role' => User::ROLE_RESIDENT]);
        $this->resident = $resident('09170000001');
        $this->neighbor = $resident('09170000002');
        $this->outsider = $resident('09170000003');

        $this->household = Household::forceCreate(['user_id' => $this->resident->id, 'barangay_id' => $this->barangay->id,
            'household_head' => 'Ana', 'status' => 'approved', 'reference_number' => 'URB-2026-000001', 'qr_secret' => 'x']);
        Household::forceCreate(['user_id' => $this->neighbor->id, 'barangay_id' => $this->barangay->id,
            'household_head' => 'Ben', 'status' => 'pending']);
        Household::forceCreate(['user_id' => $this->outsider->id, 'barangay_id' => $other->id,
            'household_head' => 'Cy', 'status' => 'approved', 'reference_number' => 'URB-2026-000003']);
    }

    private function kinds(User $u): array
    {
        return $u->notifications()->get()->pluck('data.kind')->all();
    }

    public function test_plain_announcements_do_not_create_notifications(): void
    {
        Sanctum::actingAs($this->admin);
        $this->postJson('/api/barangay/announcements', ['title' => 'Relief schedule', 'description' => 'Tomorrow 8 AM'])
            ->assertCreated();

        $this->assertSame([], $this->kinds($this->resident)); // the Announcements tab covers these
    }

    private function event(string $eligibility = 'all', string $status = 'ongoing'): array
    {
        $item = ReliefItem::forceCreate(['name' => 'Senior Kit', 'unit' => 'Kits', 'quantity_in_stock' => 50]);
        $event = DistributionEvent::forceCreate(['name' => 'Typhoon Relief', 'relief_item_id' => $item->id,
            'quantity_per_household' => 1, 'eligibility' => $eligibility, 'status' => 'open', 'created_by' => $this->admin->id]);
        $bd = BarangayDistribution::forceCreate(['distribution_event_id' => $event->id, 'barangay_id' => $this->barangay->id,
            'quota' => 10, 'status' => $status, 'venue' => 'Barangay Hall', 'started_at' => now()->subHours(3)]);

        return [$event, $bd];
    }

    public function test_sos_received_and_served(): void
    {
        Sanctum::actingAs($this->resident);
        $this->postJson('/api/resident/sos')->assertCreated();
        $this->assertSame(['sos_received'], $this->kinds($this->resident));
        $this->assertStringContainsString('#1 of 1', $this->resident->notifications()->first()->data['body']);

        Sanctum::actingAs(User::create(['name' => 'LGU', 'email' => 'lgu@test.local', 'password' => 'Password123', 'role' => User::ROLE_MUNICIPAL_ADMIN]));
        $this->postJson("/api/admin/sos/barangays/{$this->barangay->id}/serve")->assertOk();
        $this->assertEqualsCanonicalizing(['sos_received', 'sos_served'], $this->kinds($this->resident));
    }

    public function test_targeted_event_notifies_only_qualifying_households(): void
    {
        $this->household->forceFill(['seniors_count' => 2])->save();
        [$event] = $this->event('senior', 'unscheduled');

        app(ResidentNotifier::class)->eligibleForEvent($event);

        $this->assertSame(['eligible'], $this->kinds($this->resident));
        $this->assertStringContainsString('2 qualifying members', $this->resident->notifications()->first()->data['body']);
        $this->assertSame([], $this->kinds($this->outsider));

        // events for all households don't send this (the schedule notification covers them)
        [$everyone] = $this->event('all', 'unscheduled');
        app(ResidentNotifier::class)->eligibleForEvent($everyone);
        $this->assertCount(1, $this->kinds($this->resident));
    }

    public function test_unclaimed_reminder_is_sent_once_and_skips_households_that_claimed(): void
    {
        [$event] = $this->event();
        $this->artisan('relief:remind-unclaimed')->assertSuccessful();
        $this->artisan('relief:remind-unclaimed')->assertSuccessful(); // second run: no duplicate

        $this->assertSame(['reminder'], $this->kinds($this->resident));

        // a household that already claimed is not reminded
        $claimed = Household::forceCreate(['user_id' => $this->neighbor->id, 'barangay_id' => $this->barangay->id,
            'household_head' => 'Dee', 'status' => 'approved', 'reference_number' => 'URB-2026-000009', 'qr_secret' => 'y']);
        $staff = User::create(['name' => 'Staff', 'username' => 'staff2', 'password' => 'Password123', 'role' => User::ROLE_DISTRIBUTION]);
        app(DistributionEventService::class)->claim($event, 'URB-2026-000009', $staff, ['verification_method' => 'reference_number']);
        $this->artisan('relief:remind-unclaimed')->assertSuccessful();
        $this->assertNotContains('reminder', $this->kinds($this->neighbor));
    }

    public function test_security_alerts_for_new_login_and_qr_reset(): void
    {
        $login = fn () => $this->postJson('/api/login', ['login' => '09170000001', 'password' => 'Password123', 'device_name' => 'Redmi Note 13']);

        $login()->assertOk();
        $this->assertSame([], $this->kinds($this->resident)); // first phone: nothing to warn about
        $login()->assertOk();
        $this->assertSame(['security'], $this->kinds($this->resident));

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/barangay/households/{$this->household->id}/reset-qr")->assertOk();
        $this->assertSame(['security', 'security'], $this->kinds($this->resident));
    }

    public function test_approve_and_reject_notify_the_household(): void
    {
        $pending = Household::where('user_id', $this->neighbor->id)->first();
        app(HouseholdService::class)->reject($pending, $this->admin, 'Blurry ID photo.');
        app(HouseholdService::class)->approve($pending->fresh(), $this->admin);

        $this->assertEqualsCanonicalizing(['rejected', 'approved'], $this->kinds($this->neighbor));
        $this->assertSame([], $this->kinds($this->resident));
    }

    public function test_schedule_and_start_notify_approved_households_in_the_barangay(): void
    {
        $item = ReliefItem::forceCreate(['name' => 'Food Pack', 'unit' => 'Packs', 'quantity_in_stock' => 10]);
        $event = DistributionEvent::forceCreate(['name' => 'Typhoon Relief', 'relief_item_id' => $item->id,
            'quantity_per_household' => 1, 'eligibility' => 'all', 'status' => 'open', 'created_by' => $this->admin->id]);
        $bd = BarangayDistribution::forceCreate(['distribution_event_id' => $event->id, 'barangay_id' => $this->barangay->id,
            'quota' => 10, 'status' => 'unscheduled']);

        Sanctum::actingAs($this->admin);
        $this->putJson("/api/barangay/distributions/{$event->id}/schedule", [
            'scheduled_at' => now()->addDay()->toDateTimeString(), 'venue' => 'Barangay Hall',
        ])->assertOk();
        $this->postJson("/api/barangay/distributions/{$event->id}/start")->assertOk();

        $this->assertEqualsCanonicalizing(['schedule', 'started'], $this->kinds($this->resident));
        $this->assertSame([], $this->kinds($this->neighbor));  // not approved yet
        $this->assertSame([], $this->kinds($this->outsider));  // other barangay

        // the release itself notifies the household too
        $staff = User::create(['name' => 'Staff', 'username' => 'staff', 'password' => 'Password123', 'role' => User::ROLE_DISTRIBUTION]);
        app(DistributionEventService::class)->claim($event, 'URB-2026-000001', $staff, ['verification_method' => 'reference_number']);

        $this->assertContains('released', $this->kinds($this->resident));
    }

    public function test_resident_lists_and_marks_notifications_read(): void
    {
        app(ResidentNotifier::class)->reviewed($this->household);
        Sanctum::actingAs($this->resident);

        $list = $this->getJson('/api/resident/notifications')->assertOk()
            ->assertJsonPath('unread', 1)
            ->assertJsonPath('notifications.0.kind', 'approved')
            ->assertJsonPath('notifications.0.link', '/home')
            ->assertJsonPath('notifications.0.read', false);

        $this->postJson('/api/resident/notifications/read', ['ids' => [$list->json('notifications.0.id')]])
            ->assertOk()->assertJsonPath('unread', 0);
        $this->getJson('/api/resident/notifications/unread')->assertJsonPath('unread', 0);
    }
}
