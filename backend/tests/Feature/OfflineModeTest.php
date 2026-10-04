<?php

namespace Tests\Feature;

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
 * Offline mode: staff phones download the household list while online, release by reference
 * number while offline, and sync the claims later.
 * Run with: php artisan test --filter=OfflineModeTest
 */
class OfflineModeTest extends TestCase
{
    use RefreshDatabase;

    private Barangay $barangay;
    private User $staff;
    private DistributionEvent $event;
    private BarangayDistribution $bd;
    private Household $waiting;
    private Household $claimed;

    protected function setUp(): void
    {
        parent::setUp();

        $this->barangay = Barangay::create(['name' => 'Poblacion']);
        $other = Barangay::create(['name' => 'Malaca']);
        $admin = User::create(['name' => 'LGU', 'email' => 'lgu@test.local', 'password' => 'Password123', 'role' => User::ROLE_MUNICIPAL_ADMIN]);
        $this->staff = User::create(['name' => 'Staff', 'username' => 'pob.staff', 'password' => 'Password123', 'role' => User::ROLE_DISTRIBUTION]);

        $item = ReliefItem::forceCreate(['name' => 'Food Pack', 'unit' => 'Packs', 'quantity_in_stock' => 500]);
        $this->event = DistributionEvent::forceCreate([
            'name' => 'Typhoon Relief', 'relief_item_id' => $item->id, 'quantity_per_household' => 2,
            'eligibility' => 'all', 'status' => 'open', 'created_by' => $admin->id,
        ]);
        $this->bd = BarangayDistribution::forceCreate([
            'distribution_event_id' => $this->event->id, 'barangay_id' => $this->barangay->id,
            'quota' => 100, 'status' => 'ongoing', 'started_at' => now(),
        ]);

        $make = fn (Barangay $b, string $ref, string $status) => Household::forceCreate([
            'barangay_id' => $b->id, 'household_head' => "Head {$ref}", 'reference_number' => $ref,
            'status' => $status, 'qr_secret' => 'secret-'.$ref,
        ]);
        $this->waiting = $make($this->barangay, 'URB-2026-000001', 'approved');
        $this->claimed = $make($this->barangay, 'URB-2026-000002', 'approved');
        $make($this->barangay, 'URB-2026-000003', 'pending');   // not approved: left out
        $make($other, 'URB-2026-000004', 'approved');           // other barangay: left out

        Distribution::forceCreate([
            'distribution_event_id' => $this->event->id, 'household_id' => $this->claimed->id,
            'relief_item_id' => $item->id, 'distributed_by' => $this->staff->id, 'quantity' => 2,
            'distributed_at' => now(),
        ]);
    }

    private function pack()
    {
        Sanctum::actingAs($this->staff);

        return $this->getJson("/api/distribution/events/{$this->event->id}/offline-pack?barangay_id={$this->barangay->id}");
    }

    public function test_pack_lists_only_this_barangays_approved_households_with_claim_status(): void
    {
        $res = $this->pack()->assertOk()
            ->assertJsonPath('unit', 'Packs')
            ->assertJsonPath('quota', 100)
            ->assertJsonPath('claimed', 1)
            ->assertJsonCount(2, 'households');

        $byRef = collect($res->json('households'))->keyBy('reference_number');
        $this->assertNull($byRef['URB-2026-000001']['claimed_at']);
        $this->assertNotNull($byRef['URB-2026-000002']['claimed_at']);
        $this->assertSame(2, $byRef['URB-2026-000001']['quantity']);
    }

    public function test_pack_never_contains_qr_secrets(): void
    {
        $this->assertStringNotContainsString('secret-', $this->pack()->assertOk()->getContent());
    }

    public function test_no_pack_when_the_barangay_distribution_is_not_running(): void
    {
        $this->bd->forceFill(['status' => 'closed', 'closed_at' => now()])->save();

        $this->pack()->assertStatus(409);
    }

    public function test_offline_claim_syncs_even_after_the_distribution_closed(): void
    {
        $this->bd->forceFill(['status' => 'closed', 'closed_at' => now()])->save();
        Sanctum::actingAs($this->staff);

        $this->postJson("/api/distribution/events/{$this->event->id}/claims", [
            'reference_number' => 'URB-2026-000001',
            'synced_from_offline' => true,
            'distributed_at' => now()->subHour()->toIso8601String(),
        ])->assertCreated();

        $this->assertTrue((bool) Distribution::where('household_id', $this->waiting->id)->value('synced_from_offline'));
    }

    public function test_second_offline_claim_for_same_household_is_rejected_on_sync(): void
    {
        Sanctum::actingAs($this->staff);

        $this->postJson("/api/distribution/events/{$this->event->id}/claims", [
            'reference_number' => 'URB-2026-000002',
            'synced_from_offline' => true,
            'distributed_at' => now()->toIso8601String(),
        ])->assertStatus(409)->assertJsonPath('code', 'already_claimed');
    }
}
