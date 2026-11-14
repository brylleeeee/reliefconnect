<?php

namespace Tests\Feature;

use App\Models\Announcement;
use App\Models\Barangay;
use App\Models\BarangayDistribution;
use App\Models\Distribution;
use App\Models\DistributionEvent;
use App\Models\Household;
use App\Models\ReliefItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Resident announcement page: an announcement about a distribution carries the real
 * when / where / what details for the resident's household.
 * Run with: php artisan test --filter=ResidentAnnouncementDetailsTest
 */
class ResidentAnnouncementDetailsTest extends TestCase
{
    use RefreshDatabase;

    private Barangay $brgy;
    private User $resident;
    private Household $household;
    private DistributionEvent $event;
    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        $this->brgy = Barangay::create(['name' => 'Bayaoas']);
        $admin = User::create(['name' => 'LGU', 'email' => 'lgu@test.local', 'password' => 'Password123', 'role' => User::ROLE_MUNICIPAL_ADMIN]);
        $this->staff = User::create(['name' => 'Staff', 'username' => 'bay.staff', 'password' => 'Password123', 'role' => User::ROLE_DISTRIBUTION]);
        $this->resident = User::create(['name' => 'Test', 'phone' => '09170000093', 'password' => 'Password123', 'role' => User::ROLE_RESIDENT]);
        $this->household = Household::forceCreate(['user_id' => $this->resident->id, 'barangay_id' => $this->brgy->id, 'household_head' => 'Test', 'reference_number' => 'URB-2026-000093', 'status' => 'approved']);

        $item = ReliefItem::forceCreate(['name' => 'Food Pack', 'unit' => 'Packs', 'quantity_in_stock' => 10]);
        $this->event = DistributionEvent::forceCreate(['name' => 'Typhoon Relief', 'relief_item_id' => $item->id, 'quantity_per_household' => 1, 'status' => 'open', 'created_by' => $admin->id]);
        BarangayDistribution::forceCreate(['distribution_event_id' => $this->event->id, 'barangay_id' => $this->brgy->id, 'quota' => 10,
            'status' => 'scheduled', 'venue' => 'Bayaoas Hall', 'scheduled_at' => now()->addDay()]);

        Announcement::forceCreate(['user_id' => $this->staff->id, 'barangay_id' => $this->brgy->id, 'distribution_event_id' => $this->event->id,
            'category' => 'Distribution', 'title' => 'Relief day', 'description' => 'See you there', 'published_at' => now()]);
        Announcement::forceCreate(['user_id' => $this->staff->id, 'barangay_id' => $this->brgy->id,
            'title' => 'Clean-up drive', 'description' => 'Saturday', 'published_at' => now()->subHour()]);
    }

    public function test_distribution_announcements_carry_the_details(): void
    {
        Sanctum::actingAs($this->resident);

        $this->getJson('/api/resident/announcements')
            ->assertOk()
            ->assertJsonPath('data.0.distribution.event', 'Typhoon Relief')
            ->assertJsonPath('data.0.distribution.you_get', '1 Pack')
            ->assertJsonPath('data.0.distribution.venue', 'Bayaoas Hall')
            ->assertJsonPath('data.0.distribution.status', 'scheduled')
            ->assertJsonPath('data.0.distribution.claimed_at', null)
            ->assertJsonPath('data.1.distribution', null);
    }

    public function test_a_claimed_distribution_says_so(): void
    {
        Distribution::forceCreate(['distribution_event_id' => $this->event->id, 'household_id' => $this->household->id,
            'relief_item_id' => $this->event->relief_item_id, 'distributed_by' => $this->staff->id, 'quantity' => 1, 'distributed_at' => now()]);
        Sanctum::actingAs($this->resident);

        $claimed = $this->getJson('/api/resident/announcements')->assertOk()->json('data.0.distribution.claimed_at');
        $this->assertNotNull($claimed);
    }
}
