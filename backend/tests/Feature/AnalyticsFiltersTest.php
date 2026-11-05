<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Distribution;
use App\Models\Household;
use App\Models\ReliefItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Dashboard analytics filters (panel recommendation): date range, barangay and relief item.
 * Run with: php artisan test --filter=AnalyticsFiltersTest
 */
class AnalyticsFiltersTest extends TestCase
{
    use RefreshDatabase;

    public function test_filters_narrow_the_period_figures(): void
    {
        $a = Barangay::create(['name' => 'Angatel']);
        $b = Barangay::create(['name' => 'Baug']);
        $admin = User::create(['name' => 'LGU', 'email' => 'lgu@test.local', 'password' => 'Password123', 'role' => User::ROLE_MUNICIPAL_ADMIN]);
        $staff = User::create(['name' => 'Staff', 'username' => 'staff', 'password' => 'Password123', 'role' => User::ROLE_DISTRIBUTION]);

        $ha = Household::forceCreate(['barangay_id' => $a->id, 'household_head' => 'A', 'status' => 'approved']);
        $hb = Household::forceCreate(['barangay_id' => $b->id, 'household_head' => 'B', 'status' => 'approved']);
        Household::forceCreate(['barangay_id' => $b->id, 'household_head' => 'B2', 'status' => 'pending']);

        $rice = ReliefItem::forceCreate(['name' => 'Rice', 'unit' => 'Sacks', 'quantity_in_stock' => 100]);
        $kit = ReliefItem::forceCreate(['name' => 'Hygiene Kit', 'unit' => 'Kits', 'quantity_in_stock' => 100]);
        $cash = ReliefItem::forceCreate(['type' => 'cash', 'name' => 'Cash Fund', 'unit' => 'PHP', 'quantity_in_stock' => 5000]);

        $give = fn ($h, $i, $qty, $at) => Distribution::forceCreate([
            'household_id' => $h->id, 'relief_item_id' => $i->id, 'distributed_by' => $staff->id,
            'quantity' => $qty, 'verification_method' => 'qr', 'distributed_at' => $at,
        ]);
        $give($ha, $rice, 2, now()->subDays(3));
        $give($hb, $kit, 5, now()->subDays(3));
        $give($hb, $cash, 1000, now()->subDays(2));
        $give($ha, $rice, 7, now()->subDays(100)); // outside the default 30 days

        Sanctum::actingAs($admin);

        // Default: last 30 days, whole municipality
        $this->getJson('/api/admin/analytics')->assertOk()
            ->assertJsonPath('filters.days', 30)
            ->assertJsonPath('filters.granularity', 'day')
            ->assertJsonPath('kpis.units_distributed', 7)
            ->assertJsonPath('kpis.cash_released', 1000)
            ->assertJsonPath('kpis.households_reached', 2)
            ->assertJsonPath('kpis.pending_registrations', 1)
            ->assertJsonCount(30, 'daily')
            ->assertJsonCount(3, 'options.items');

        // One barangay
        $this->getJson("/api/admin/analytics?barangay_id={$b->id}")->assertOk()
            ->assertJsonPath('kpis.units_distributed', 5)
            ->assertJsonPath('kpis.registered_households', 1)
            ->assertJsonPath('kpis.pending_registrations', 1)
            ->assertJsonCount(1, 'by_barangay')
            ->assertJsonPath('by_barangay.0.name', 'Baug');

        // One item
        $this->getJson("/api/admin/analytics?relief_item_id={$rice->id}")->assertOk()
            ->assertJsonPath('kpis.units_distributed', 2)
            ->assertJsonPath('kpis.cash_released', 0)
            ->assertJsonPath('kpis.households_reached', 1);

        // A longer period picks up the old release and groups the chart by week
        $from = now()->subDays(120)->toDateString();
        $this->getJson("/api/admin/analytics?from={$from}&to=".now()->toDateString())->assertOk()
            ->assertJsonPath('kpis.units_distributed', 14)
            ->assertJsonPath('filters.granularity', 'week');

        // Bad range
        $this->getJson('/api/admin/analytics?from=2026-05-10&to=2026-05-01')
            ->assertUnprocessable()->assertJsonValidationErrors('to');
    }
}
