<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Household;
use App\Models\ReliefItem;
use App\Models\SosAlert;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Aid Prioritization: active SOS add points to their barangay's demand, so it gets more packs.
 * Run with: php artisan test --filter=SosAidPriorityTest
 */
class SosAidPriorityTest extends TestCase
{
    use RefreshDatabase;

    private Barangay $asking;
    private Barangay $quiet;
    private ReliefItem $item;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::create([
            'name' => 'LGU', 'email' => 'lgu@test.local', 'password' => 'Password123', 'role' => User::ROLE_MUNICIPAL_ADMIN,
        ]));

        $this->asking = Barangay::create(['name' => 'Asking']);
        $this->quiet = Barangay::create(['name' => 'Quiet']);
        $this->item = ReliefItem::forceCreate(['name' => 'Food Pack', 'unit' => 'Packs', 'quantity_in_stock' => 3]);

        // Same households in both barangays: 2 low-priority each
        foreach ([$this->asking, $this->quiet] as $b) {
            foreach ([1, 2] as $n) {
                Household::forceCreate(['barangay_id' => $b->id, 'household_head' => "{$b->name} {$n}", 'status' => 'approved', 'priority_level' => 'low']);
            }
        }
    }

    private function row(string $name): array
    {
        $res = $this->getJson("/api/admin/prioritization?relief_item_id={$this->item->id}&packs=3")->assertOk();

        return collect($res->json('barangays'))->firstWhere('name', $name);
    }

    public function test_active_sos_adds_points_and_more_packs(): void
    {
        $household = Household::where('barangay_id', $this->asking->id)->first();
        SosAlert::create(['household_id' => $household->id, 'barangay_id' => $this->asking->id, 'people_count' => 1]);

        $asking = $this->row('Asking');
        $this->assertSame(1, $asking['sos']);
        $this->assertSame(3, $asking['sos_points']);
        $this->assertSame(2, $asking['allocation']);       // 3 packs split 2 : 1 because of the SOS
        $this->assertSame(1, $this->row('Quiet')['allocation']);
    }

    public function test_served_cancelled_and_unapproved_sos_do_not_count(): void
    {
        $household = Household::where('barangay_id', $this->asking->id)->first();
        $pending = Household::forceCreate(['barangay_id' => $this->asking->id, 'household_head' => 'Not approved', 'status' => 'pending']);

        SosAlert::create(['household_id' => $household->id, 'barangay_id' => $this->asking->id, 'people_count' => 1, 'status' => 'served']);
        SosAlert::create(['household_id' => $household->id, 'barangay_id' => $this->asking->id, 'people_count' => 1, 'status' => 'cancelled']);
        SosAlert::create(['household_id' => $pending->id, 'barangay_id' => $this->asking->id, 'people_count' => 1]);

        $this->assertSame(0, $this->row('Asking')['sos']);
    }
}
