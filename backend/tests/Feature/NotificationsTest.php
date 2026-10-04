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

    public function test_barangay_announcement_notifies_only_that_barangays_residents(): void
    {
        Sanctum::actingAs($this->admin);
        $this->postJson('/api/barangay/announcements', ['title' => 'Relief schedule', 'description' => 'Tomorrow 8 AM'])
            ->assertCreated();

        $this->assertSame(['announcement'], $this->kinds($this->resident));
        $this->assertSame(['announcement'], $this->kinds($this->neighbor)); // pending households still get announcements
        $this->assertSame([], $this->kinds($this->outsider));
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
