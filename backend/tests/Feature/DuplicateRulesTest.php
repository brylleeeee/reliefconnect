<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Household;
use App\Models\HouseholdMember;
use App\Models\User;
use App\Services\HouseholdService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Stricter duplicate rules (adviser): normalized names, one head per person, members move on approval.
 * Run with: php artisan test --filter=DuplicateRulesTest
 */
class DuplicateRulesTest extends TestCase
{
    use RefreshDatabase;

    private Barangay $brgy;
    private User $admin;
    private Household $parents;

    protected function setUp(): void
    {
        parent::setUp();
        $this->brgy = Barangay::create(['name' => 'Malaca']);
        $this->admin = User::create(['name' => 'Kap', 'email' => 'kap@test.local', 'password' => 'Password123', 'role' => User::ROLE_BARANGAY_ADMIN, 'barangay_id' => $this->brgy->id]);

        // Existing approved household: Pedro (head) with his daughter Ana
        $this->parents = app(HouseholdService::class)->save(
            (new Household)->forceFill(['barangay_id' => $this->brgy->id, 'status' => 'approved', 'reference_number' => 'URB-2026-000001']),
            ['purok' => 'Purok 1', 'members' => [
                ['full_name' => 'Pedro Dela Cruz', 'relationship' => 'Head', 'birthdate' => '1950-03-01', 'sex' => 'M'],
                ['full_name' => 'Ma. Ana Dela Cruz', 'relationship' => 'Child', 'birthdate' => '1995-07-15', 'sex' => 'F'],
            ]],
        );
        Sanctum::actingAs($this->admin);
    }

    private function walkIn(array $members)
    {
        return $this->postJson('/api/barangay/households', [
            'purok' => 'Purok 2', 'contact_number' => '0917'.random_int(1000000, 9999999),
            'password' => 'Password123', 'members' => $members,
        ]);
    }

    public function test_the_same_head_written_differently_is_blocked(): void
    {
        $this->walkIn([['full_name' => 'PEDRO DE LA CRUZ', 'relationship' => 'Head', 'birthdate' => '1950-03-01', 'sex' => 'M']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('members.0.full_name');
    }

    public function test_another_households_head_cannot_be_added_as_a_member(): void
    {
        $res = $this->walkIn([
            ['full_name' => 'Juan Dela Cruz', 'relationship' => 'Head', 'birthdate' => '1975-01-01', 'sex' => 'M'],
            ['full_name' => 'Pedro Dela Cruz', 'relationship' => 'Parent', 'birthdate' => '1950-03-01', 'sex' => 'M'],
        ])->assertUnprocessable();
        $this->assertStringContainsString('authorized representative', $res->json('errors')['members.1.full_name'][0]);
    }

    public function test_a_member_listed_elsewhere_moves_when_the_new_household_is_approved(): void
    {
        // Ana marries and registers her own household (walk-in is approved right away)
        $this->walkIn([
            ['full_name' => 'Maria Ana Dela Cruz', 'relationship' => 'Head', 'birthdate' => '1995-07-15', 'sex' => 'F'],
            ['full_name' => 'Ben Reyes', 'relationship' => 'Spouse', 'birthdate' => '1994-02-02', 'sex' => 'M'],
        ])->assertCreated();

        $this->assertCount(1, $this->parents->fresh()->members); // removed from her parents' household
        $this->assertSame(1, HouseholdMember::where('name_key', 'maria ana dela cruz')->count()); // counted once
        $this->assertNull(HouseholdMember::where('name_key', 'maria ana dela cruz')->first()->transfer_from_household_id);
    }

    public function test_a_pending_registration_waits_and_shows_the_transfer_to_the_reviewer(): void
    {
        $resident = User::create(['name' => 'Ana', 'phone' => '09173334444', 'password' => 'Password123', 'role' => User::ROLE_RESIDENT]);
        $pending = app(HouseholdService::class)->save(
            (new Household)->forceFill(['user_id' => $resident->id, 'barangay_id' => $this->brgy->id, 'status' => 'pending']),
            ['purok' => 'Purok 3', 'members' => [
                ['full_name' => 'Ana Dela Cruz', 'relationship' => 'Head', 'birthdate' => '1990-01-01', 'sex' => 'F'],
                ['full_name' => 'Maria Ana Dela Cruz', 'relationship' => 'Sibling', 'birthdate' => '1995-07-15', 'sex' => 'F'],
            ]],
        );

        $this->assertCount(2, $this->parents->fresh()->members); // not moved yet
        $this->getJson("/api/barangay/households/{$pending->id}")->assertOk()
            ->assertJsonPath('duplicate_check.transfers.0.member', 'Maria Ana Dela Cruz')
            ->assertJsonPath('duplicate_check.transfers.0.household.reference_number', 'URB-2026-000001');

        $this->postJson("/api/barangay/households/{$pending->id}/approve")->assertOk();
        $this->assertCount(1, $this->parents->fresh()->members);
        $this->assertDatabaseHas('notifications', ['type' => 'App\\Notifications\\ResidentAlert']);
    }

    public function test_same_person_twice_in_one_household_and_similar_names_are_flagged(): void
    {
        $this->walkIn([
            ['full_name' => 'Rosa Lim', 'relationship' => 'Head', 'birthdate' => '1980-05-05', 'sex' => 'F'],
            ['full_name' => 'ROSA LIM', 'relationship' => 'Relative', 'birthdate' => '1980-05-05', 'sex' => 'F'],
        ])->assertUnprocessable()->assertJsonValidationErrors('members.1.full_name');

        // "Pedro D. Dela Cruz" as a member elsewhere: not the same key, but likely the same person -> warning only
        $id = $this->walkIn([
            ['full_name' => 'Carlo Santos', 'relationship' => 'Head', 'birthdate' => '1985-08-08', 'sex' => 'M'],
            ['full_name' => 'Pedro D. Dela Cruz', 'relationship' => 'Relative', 'birthdate' => '1950-03-01', 'sex' => 'M'],
        ])->assertCreated()->json('id');

        $this->getJson("/api/barangay/households/{$id}")->assertOk()
            ->assertJsonPath('duplicate_check.possible_matches.0.member', 'Pedro D. Dela Cruz')
            ->assertJsonPath('duplicate_check.possible_matches.0.other_name', 'Pedro Dela Cruz');
    }
}
