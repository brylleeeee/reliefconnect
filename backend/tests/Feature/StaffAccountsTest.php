<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\BarangayDistribution;
use App\Models\DistributionEvent;
use App\Models\Household;
use App\Models\ReliefItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Barangay admins manage their own staff accounts; staff only serve their own barangay.
 * Run with: php artisan test --filter=StaffAccountsTest
 */
class StaffAccountsTest extends TestCase
{
    use RefreshDatabase;

    private Barangay $mine;
    private Barangay $other;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->mine = Barangay::create(['name' => 'Batangcaoa']);
        $this->other = Barangay::create(['name' => 'Poblacion']);
        $this->admin = User::create(['name' => 'Brgy Admin', 'email' => 'admin@test.local', 'password' => 'Password123',
            'role' => User::ROLE_BARANGAY_ADMIN, 'barangay_id' => $this->mine->id]);
    }

    private function createStaff(array $overrides = [])
    {
        Sanctum::actingAs($this->admin);

        return $this->postJson('/api/barangay/staff', $overrides + [
            'name' => 'Juan Cruz', 'username' => 'btc.juan', 'phone' => '09171112222', 'password' => 'TempPass1',
        ]);
    }

    public function test_admin_creates_staff_who_can_log_in_to_the_mobile_app(): void
    {
        $this->createStaff()->assertCreated()->assertJsonPath('username', 'btc.juan');

        $staff = User::where('username', 'btc.juan')->first();
        $this->assertSame(User::ROLE_DISTRIBUTION, $staff->role);
        $this->assertSame($this->mine->id, $staff->barangay_id);

        $this->getJson('/api/barangay/staff')->assertOk()->assertJsonCount(1)->assertJsonPath('0.name', 'Juan Cruz');

        $this->postJson('/api/login', ['login' => 'btc.juan', 'password' => 'TempPass1'])->assertOk();
    }

    public function test_username_and_phone_must_be_unique_and_valid(): void
    {
        $this->createStaff()->assertCreated();
        $this->createStaff(['phone' => null])->assertJsonValidationErrors('username');
        $this->createStaff(['username' => 'btc.ana'])->assertJsonValidationErrors('phone');
        $this->createStaff(['username' => 'has space', 'phone' => null])->assertJsonValidationErrors('username');
        $this->createStaff(['username' => 'btc.ben', 'phone' => '12345'])->assertJsonValidationErrors('phone');
    }

    public function test_deactivated_staff_cannot_log_in_and_is_logged_out(): void
    {
        $this->createStaff()->assertCreated();
        $staff = User::where('username', 'btc.juan')->first();
        $staff->createToken('phone');

        $this->postJson("/api/barangay/staff/{$staff->id}/deactivate")->assertOk();
        $this->assertSame(0, $staff->tokens()->count());
        $this->postJson('/api/login', ['login' => 'btc.juan', 'password' => 'TempPass1'])
            ->assertUnprocessable()->assertJsonValidationErrors('login');

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/barangay/staff/{$staff->id}/activate")->assertOk();
        $this->postJson('/api/login', ['login' => 'btc.juan', 'password' => 'TempPass1'])->assertOk();
    }

    public function test_reset_password_sets_a_new_temporary_password(): void
    {
        $this->createStaff()->assertCreated();
        $staff = User::where('username', 'btc.juan')->first();

        $this->postJson("/api/barangay/staff/{$staff->id}/reset-password", ['password' => 'NewTemp22'])->assertOk();
        $this->postJson('/api/login', ['login' => 'btc.juan', 'password' => 'NewTemp22'])->assertOk();
    }

    public function test_admin_cannot_touch_another_barangays_staff(): void
    {
        $theirs = User::create(['name' => 'Other Staff', 'username' => 'pob.staff', 'password' => 'Password123',
            'role' => User::ROLE_DISTRIBUTION, 'barangay_id' => $this->other->id]);

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/barangay/staff')->assertOk()->assertJsonCount(0);
        $this->postJson("/api/barangay/staff/{$theirs->id}/deactivate")->assertNotFound();
        $this->postJson("/api/barangay/staff/{$this->admin->id}/reset-password", ['password' => 'Whatever1'])->assertNotFound();
    }

    public function test_staff_only_see_and_serve_their_own_barangay(): void
    {
        $item = ReliefItem::forceCreate(['name' => 'Food Pack', 'unit' => 'Packs', 'quantity_in_stock' => 100]);
        $event = DistributionEvent::forceCreate(['name' => 'Typhoon Relief', 'relief_item_id' => $item->id,
            'quantity_per_household' => 1, 'eligibility' => 'all', 'status' => 'open', 'created_by' => $this->admin->id]);
        foreach ([$this->mine, $this->other] as $b) {
            BarangayDistribution::forceCreate(['distribution_event_id' => $event->id, 'barangay_id' => $b->id,
                'quota' => 10, 'status' => 'ongoing', 'started_at' => now(), 'venue' => "{$b->name} Hall"]);
        }
        Household::forceCreate(['barangay_id' => $this->other->id, 'household_head' => 'Outsider',
            'status' => 'approved', 'reference_number' => 'URB-2026-000500']);

        $staff = User::create(['name' => 'Juan', 'username' => 'btc.juan', 'password' => 'Password123',
            'role' => User::ROLE_DISTRIBUTION, 'barangay_id' => $this->mine->id]);
        Sanctum::actingAs($staff);

        $this->getJson('/api/distribution/events')->assertOk()
            ->assertJsonCount(1)->assertJsonPath('0.barangay', 'Batangcaoa');

        $this->getJson("/api/distribution/events/{$event->id}/check?reference_number=URB-2026-000500")->assertForbidden();
        $this->postJson("/api/distribution/events/{$event->id}/claims", ['reference_number' => 'URB-2026-000500'])->assertForbidden();
        $this->getJson("/api/distribution/events/{$event->id}/offline-pack?barangay_id={$this->other->id}")->assertForbidden();
    }
}
