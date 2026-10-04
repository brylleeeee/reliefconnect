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
 * Resident History tab: shows the household's real releases (goods and cash), newest first.
 * Run with: php artisan test --filter=ResidentHistoryTest
 */
class ResidentHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_resident_sees_only_their_own_releases_newest_first(): void
    {
        $brgy = Barangay::create(['name' => 'Bayaoas']);
        $admin = User::create(['name' => 'LGU', 'email' => 'lgu@test.local', 'password' => 'Password123', 'role' => User::ROLE_MUNICIPAL_ADMIN]);
        $staff = User::create(['name' => 'Staff', 'username' => 'bay.staff', 'password' => 'Password123', 'role' => User::ROLE_DISTRIBUTION]);
        $resident = User::create(['name' => 'Test', 'phone' => '09170000093', 'password' => 'Password123', 'role' => User::ROLE_RESIDENT]);
        $other = User::create(['name' => 'Other', 'phone' => '09170000094', 'password' => 'Password123', 'role' => User::ROLE_RESIDENT]);

        $mine = Household::forceCreate(['user_id' => $resident->id, 'barangay_id' => $brgy->id, 'household_head' => 'Test', 'reference_number' => 'URB-2026-000093', 'status' => 'approved']);
        $theirs = Household::forceCreate(['user_id' => $other->id, 'barangay_id' => $brgy->id, 'household_head' => 'Other', 'reference_number' => 'URB-2026-000094', 'status' => 'approved']);

        $goods = ReliefItem::forceCreate(['name' => 'TEST', 'unit' => 'Pieces', 'quantity_in_stock' => 10]);
        $cash = ReliefItem::forceCreate(['type' => 'cash', 'name' => 'Emergency Cash Assistance Fund', 'unit' => 'PHP', 'quantity_in_stock' => 10000]);
        $event = DistributionEvent::forceCreate(['name' => 'Test', 'relief_item_id' => $goods->id, 'quantity_per_household' => 1, 'status' => 'open', 'created_by' => $admin->id]);
        BarangayDistribution::forceCreate(['distribution_event_id' => $event->id, 'barangay_id' => $brgy->id, 'quota' => 10, 'status' => 'ongoing', 'venue' => 'Bayaoas Hall']);

        $release = fn (Household $h, ReliefItem $i, int $qty, $at) => Distribution::forceCreate([
            'distribution_event_id' => $i->is($goods) ? $event->id : null, 'household_id' => $h->id,
            'relief_item_id' => $i->id, 'distributed_by' => $staff->id, 'quantity' => $qty, 'distributed_at' => $at,
        ]);
        $release($mine, $cash, 1000, now()->subHour());
        $release($mine, $goods, 1, now());
        $release($theirs, $goods, 1, now());

        Sanctum::actingAs($resident);
        $this->getJson('/api/resident/claims')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.item', 'TEST')
            ->assertJsonPath('0.is_cash', false)
            ->assertJsonPath('0.venue', 'Bayaoas Hall')
            ->assertJsonPath('1.is_cash', true)
            ->assertJsonPath('1.quantity', 1000);
    }

    public function test_resident_without_a_household_gets_an_empty_history(): void
    {
        $resident = User::create(['name' => 'New', 'phone' => '09170000099', 'password' => 'Password123', 'role' => User::ROLE_RESIDENT]);
        Sanctum::actingAs($resident);

        $this->getJson('/api/resident/claims')->assertOk()->assertExactJson([]);
    }
}
