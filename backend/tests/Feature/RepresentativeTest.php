<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\BarangayDistribution;
use App\Models\Distribution;
use App\Models\DistributionEvent;
use App\Models\Household;
use App\Models\ReliefItem;
use App\Models\User;
use App\Services\HouseholdService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Authorized representatives (adviser): a son claims for his senior parents' household without
 * becoming a member of it. Run with: php artisan test --filter=RepresentativeTest
 */
class RepresentativeTest extends TestCase
{
    use RefreshDatabase;

    private Barangay $brgy;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->brgy = Barangay::create(['name' => 'Malaca']);
        $this->admin = User::create(['name' => 'Kap', 'email' => 'kap@test.local', 'password' => 'Password123', 'role' => User::ROLE_BARANGAY_ADMIN, 'barangay_id' => $this->brgy->id]);
        Sanctum::actingAs($this->admin);
    }

    private function household(string $head, string $birthdate, int $n): Household
    {
        return app(HouseholdService::class)->save(
            (new Household)->forceFill(['barangay_id' => $this->brgy->id, 'status' => 'approved', 'reference_number' => sprintf('URB-2026-%06d', $n), 'qr_secret' => 's'.$n]),
            ['purok' => 'Purok 1', 'members' => [['full_name' => $head, 'relationship' => 'Head', 'birthdate' => $birthdate, 'sex' => 'M']]],
        );
    }

    private function juan(array $extra = []): array
    {
        return array_merge(['full_name' => 'Juan Cruz', 'relationship' => 'Son', 'birthdate' => '1985-06-01', 'contact_number' => '09171234567'], $extra);
    }

    public function test_barangay_adds_a_representative_who_is_not_counted_as_a_member(): void
    {
        $lolo = $this->household('Pedro Cruz', '1950-01-01', 1);
        $score = $lolo->priority_score;

        $this->putJson("/api/barangay/households/{$lolo->id}/representative", $this->juan())->assertOk();

        $this->getJson("/api/barangay/households/{$lolo->id}")->assertOk()
            ->assertJsonPath('representative.full_name', 'Juan Cruz')
            ->assertJsonPath('representative.relationship', 'Son')
            ->assertJsonCount(1, 'members');
        $this->assertSame($score, $lolo->fresh()->priority_score);

        $this->deleteJson("/api/barangay/households/{$lolo->id}/representative")->assertOk();
        $this->assertNull($lolo->fresh()->representative);
    }

    public function test_one_person_can_represent_at_most_two_households_and_not_their_own(): void
    {
        $a = $this->household('Pedro Cruz', '1950-01-01', 1);
        $b = $this->household('Rosa Cruz', '1948-02-02', 2);
        $c = $this->household('Lito Cruz', '1946-03-03', 3);

        $this->putJson("/api/barangay/households/{$a->id}/representative", $this->juan())->assertOk();
        $this->putJson("/api/barangay/households/{$b->id}/representative", $this->juan(['full_name' => 'JUAN  CRUZ']))->assertOk();
        $this->putJson("/api/barangay/households/{$c->id}/representative", $this->juan())
            ->assertUnprocessable()->assertJsonValidationErrors('full_name');

        // A member doesn't need to be the representative
        $this->putJson("/api/barangay/households/{$c->id}/representative", ['full_name' => 'Lito Cruz', 'relationship' => 'Relative', 'birthdate' => '1946-03-03'])
            ->assertUnprocessable()->assertJsonValidationErrors('full_name');

        // Must be an adult
        $this->putJson("/api/barangay/households/{$c->id}/representative", $this->juan(['full_name' => 'Kid Cruz', 'birthdate' => now()->subYears(15)->toDateString()]))
            ->assertUnprocessable()->assertJsonValidationErrors('birthdate');
    }

    public function test_staff_see_the_representative_and_the_claim_records_who_received_it(): void
    {
        $lolo = $this->household('Pedro Cruz', '1950-01-01', 1);
        $other = $this->household('Ana Reyes', '1980-01-01', 2);
        $this->putJson("/api/barangay/households/{$lolo->id}/representative", $this->juan())->assertOk();

        $item = ReliefItem::forceCreate(['name' => 'Food Pack', 'unit' => 'Packs', 'quantity_in_stock' => 10]);
        $event = DistributionEvent::forceCreate(['name' => 'Typhoon relief', 'relief_item_id' => $item->id, 'quantity_per_household' => 1, 'eligibility' => 'all', 'status' => 'open', 'created_by' => $this->admin->id]);
        BarangayDistribution::forceCreate(['distribution_event_id' => $event->id, 'barangay_id' => $this->brgy->id, 'quota' => 10, 'status' => 'ongoing', 'started_at' => now()]);

        Sanctum::actingAs(User::create(['name' => 'Staff', 'username' => 'staff1', 'password' => 'Password123', 'role' => User::ROLE_DISTRIBUTION, 'barangay_id' => $this->brgy->id]));

        $this->getJson("/api/distribution/events/{$event->id}/check?reference_number=URB-2026-000001")->assertOk()
            ->assertJsonPath('representative.full_name', 'Juan Cruz');
        $this->getJson("/api/distribution/events/{$event->id}/offline-pack?barangay_id={$this->brgy->id}")->assertOk()
            ->assertJsonPath('households.0.representative.relationship', 'Son');

        $this->postJson("/api/distribution/events/{$event->id}/claims", ['reference_number' => 'URB-2026-000001', 'claimed_by_representative' => true])
            ->assertCreated();
        $this->assertSame('Juan Cruz (Son)', Distribution::where('household_id', $lolo->id)->value('claimant_name'));

        // A household without a representative can't be claimed "by representative"
        $this->postJson("/api/distribution/events/{$event->id}/claims", ['reference_number' => 'URB-2026-000002', 'claimed_by_representative' => true])
            ->assertStatus(409);
        $this->assertFalse(Distribution::where('household_id', $other->id)->exists());
    }
}
