<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Household;
use App\Models\User;
use App\Services\HouseholdService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Scoring updates (adviser): households with no able-bodied adult get extra points and the
 * needs-assistance flag; members waiting to move in don't count yet.
 * Run with: php artisan test --filter=ScoringUpdatesTest
 */
class ScoringUpdatesTest extends TestCase
{
    use RefreshDatabase;

    private Barangay $brgy;

    protected function setUp(): void
    {
        parent::setUp();
        $this->brgy = Barangay::create(['name' => 'Malaca']);
    }

    private function save(array $members, string $status = 'approved'): Household
    {
        return app(HouseholdService::class)->save(
            (new Household)->forceFill(['barangay_id' => $this->brgy->id, 'status' => $status]),
            ['purok' => 'Purok 1', 'members' => $members],
        );
    }

    private function m(string $name, int $age, string $rel = 'Head', bool $pwd = false): array
    {
        return ['full_name' => $name, 'relationship' => $rel, 'birthdate' => now()->subYears($age)->subDays(10)->toDateString(), 'sex' => 'F', 'is_pwd' => $pwd];
    }

    public function test_senior_living_alone_is_high_priority_and_needs_assistance(): void
    {
        $h = $this->save([$this->m('Lenita Ramos', 76)]);

        $this->assertTrue($h->needs_assistance);
        $this->assertSame(8, $h->priority_score); // 3 (senior) + 5 (no able-bodied adult)
        $this->assertSame('high', $h->priority_level);
    }

    public function test_an_able_bodied_adult_removes_the_bonus_but_a_pwd_adult_does_not(): void
    {
        $withSon = $this->save([$this->m('Rosa Cruz', 72), $this->m('Ben Cruz', 40, 'Child')]);
        $this->assertFalse($withSon->needs_assistance);
        $this->assertSame('low', $withSon->priority_level); // 3 points

        $withPwd = $this->save([$this->m('Nena Lim', 70), $this->m('Rod Lim', 35, 'Child', pwd: true)]);
        $this->assertTrue($withPwd->needs_assistance);
        $this->assertSame(11, $withPwd->priority_score); // 3 + 3 + 5
    }

    public function test_a_member_waiting_to_move_in_counts_only_after_approval(): void
    {
        $this->save([$this->m('Pedro Reyes', 50), $this->m('Lola Reyes', 80, 'Parent')]);

        // Lola is still in Pedro's household: in the new (pending) one she doesn't count yet
        $pending = $this->save([$this->m('Ana Reyes', 30), $this->m('Lola Reyes', 80, 'Parent')], 'pending');
        $this->assertSame(1, $pending->members_count);
        $this->assertSame(0, $pending->seniors_count);

        $admin = User::create(['name' => 'Kap', 'email' => 'kap@test.local', 'password' => 'Password123', 'role' => User::ROLE_BARANGAY_ADMIN, 'barangay_id' => $this->brgy->id]);
        Sanctum::actingAs($admin);
        $this->postJson("/api/barangay/households/{$pending->id}/approve")->assertOk();

        $pending->refresh();
        $this->assertSame(2, $pending->members_count);
        $this->assertSame(1, $pending->seniors_count);
    }
}
