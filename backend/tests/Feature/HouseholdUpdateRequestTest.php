<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Household;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Household update requests (panel recommendation): the resident asks, the barangay approves or rejects.
 * Run with: php artisan test --filter=HouseholdUpdateRequestTest
 */
class HouseholdUpdateRequestTest extends TestCase
{
    use RefreshDatabase;

    private Barangay $brgy;
    private User $resident;
    private User $brgyAdmin;
    private Household $household;

    protected function setUp(): void
    {
        parent::setUp();
        $this->brgy = Barangay::create(['name' => 'Bayaoas']);
        $this->resident = User::create(['name' => 'Juan Cruz', 'phone' => '09170000001', 'password' => 'Password123', 'role' => User::ROLE_RESIDENT]);
        $this->brgyAdmin = User::create(['name' => 'Kap', 'email' => 'bay@test.local', 'password' => 'Password123', 'role' => User::ROLE_BARANGAY_ADMIN, 'barangay_id' => $this->brgy->id]);

        $this->household = Household::forceCreate([
            'user_id' => $this->resident->id, 'barangay_id' => $this->brgy->id, 'household_head' => 'Juan Cruz',
            'purok' => 'Purok 1', 'contact_number' => '09170000001', 'reference_number' => 'URB-2026-000001',
            'status' => 'approved', 'qr_secret' => 'secret-that-must-not-change',
        ]);
        $this->household->members()->createMany([
            ['full_name' => 'Juan Cruz', 'relationship' => 'Head', 'birthdate' => '1985-04-23', 'sex' => 'M'],
            ['full_name' => 'Maria Cruz', 'relationship' => 'Spouse', 'birthdate' => '1987-01-10', 'sex' => 'F'],
        ]);
    }

    private function payload(array $extra = []): array
    {
        return array_merge([
            'purok' => 'Purok 2',
            'address' => 'Sitio Centro',
            'is_solo_parent' => false,
            'members' => [
                ['full_name' => 'Juan Cruz', 'relationship' => 'Head', 'birthdate' => '1985-04-23', 'sex' => 'M', 'is_pwd' => false, 'is_pregnant' => false],
                ['full_name' => 'Maria Cruz', 'relationship' => 'Spouse', 'birthdate' => '1987-01-10', 'sex' => 'F', 'is_pwd' => false, 'is_pregnant' => true],
                ['full_name' => 'Baby Cruz', 'relationship' => 'Child', 'birthdate' => now()->subMonth()->toDateString(), 'sex' => 'F', 'is_pwd' => false, 'is_pregnant' => false],
            ],
            'reason' => 'New baby and we moved to Purok 2',
        ], $extra);
    }

    public function test_request_waits_for_approval_then_updates_the_household_and_keeps_the_qr(): void
    {
        Sanctum::actingAs($this->resident);
        $this->postJson('/api/resident/household/update-request', $this->payload())
            ->assertCreated()
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('summary.members_added.0.full_name', 'Baby Cruz')
            ->assertJsonPath('summary.fields.0.field', 'Purok');

        // Nothing changes before the barangay approves
        $this->assertSame('Purok 1', $this->household->fresh()->purok);
        $this->assertCount(2, $this->household->fresh()->members);

        Sanctum::actingAs($this->brgyAdmin);
        $this->getJson('/api/barangay/summary')->assertJsonPath('update_requests_pending', 1);
        $list = $this->getJson('/api/barangay/update-requests')->assertOk()->assertJsonPath('total', 1);
        $id = $list->json('data.0.id');

        $this->getJson("/api/barangay/update-requests/{$id}")
            ->assertOk()
            ->assertJsonPath('diff.members_edited.0.name', 'Maria Cruz')
            ->assertJsonPath('diff.members_edited.0.changes.0.field', 'Pregnant');

        $this->postJson("/api/barangay/update-requests/{$id}/approve")->assertOk();

        $h = $this->household->fresh();
        $this->assertSame('Purok 2', $h->purok);
        $this->assertSame('Sitio Centro', $h->address);
        $this->assertCount(3, $h->members);
        $this->assertSame(1, $h->infants_count);       // priority recomputed
        $this->assertSame(1, $h->pregnant_count);
        $this->assertSame('URB-2026-000001', $h->reference_number);
        $this->assertSame('secret-that-must-not-change', $h->qr_secret);
        $this->assertSame('09170000001', $h->contact_number);

        // Resident is told, and sees the request as approved
        $this->assertDatabaseHas('notifications', ['notifiable_id' => $this->resident->id]);
        Sanctum::actingAs($this->resident);
        $this->getJson('/api/resident/household/update-request')->assertJsonPath('status', 'approved');
    }

    public function test_rejected_request_leaves_the_household_and_shows_the_reason(): void
    {
        Sanctum::actingAs($this->resident);
        $id = $this->postJson('/api/resident/household/update-request', $this->payload())->json('id');

        Sanctum::actingAs($this->brgyAdmin);
        $this->postJson("/api/barangay/update-requests/{$id}/reject", ['reason' => 'Please bring the birth certificate'])->assertOk();
        $this->postJson("/api/barangay/update-requests/{$id}/approve")->assertUnprocessable(); // already reviewed

        $this->assertSame('Purok 1', $this->household->fresh()->purok);

        Sanctum::actingAs($this->resident);
        $this->getJson('/api/resident/household/update-request')
            ->assertJsonPath('status', 'rejected')
            ->assertJsonPath('review_note', 'Please bring the birth certificate');
        // ...and can send a new one
        $this->postJson('/api/resident/household/update-request', $this->payload())->assertCreated();
    }

    public function test_only_one_waiting_request_and_it_can_be_cancelled(): void
    {
        Sanctum::actingAs($this->resident);
        $this->postJson('/api/resident/household/update-request', $this->payload())->assertCreated();
        $this->postJson('/api/resident/household/update-request', $this->payload())->assertUnprocessable();

        $this->deleteJson('/api/resident/household/update-request')->assertOk()->assertJsonPath('status', 'cancelled');
        $this->postJson('/api/resident/household/update-request', $this->payload())->assertCreated();
    }

    public function test_a_request_must_change_something_and_household_must_be_approved(): void
    {
        Sanctum::actingAs($this->resident);
        $same = $this->payload([
            'purok' => 'Purok 1', 'address' => null,
            'members' => [
                ['full_name' => 'Juan Cruz', 'relationship' => 'Head', 'birthdate' => '1985-04-23', 'sex' => 'M'],
                ['full_name' => 'Maria Cruz', 'relationship' => 'Spouse', 'birthdate' => '1987-01-10', 'sex' => 'F'],
            ],
        ]);
        $this->postJson('/api/resident/household/update-request', $same)
            ->assertUnprocessable()->assertJsonValidationErrors('household');

        $this->household->forceFill(['status' => 'pending'])->save();
        $this->postJson('/api/resident/household/update-request', $this->payload())
            ->assertUnprocessable()->assertJsonValidationErrors('household');
    }

    public function test_corrected_name_shows_as_an_edit_and_duplicates_are_blocked(): void
    {
        $other = Household::forceCreate(['barangay_id' => $this->brgy->id, 'household_head' => 'Pedro Santos', 'status' => 'approved']);
        $other->members()->create(['full_name' => 'Pedro Santos', 'relationship' => 'Head', 'birthdate' => '1970-02-02', 'sex' => 'M']);

        Sanctum::actingAs($this->resident);
        $dup = $this->payload();
        $dup['members'][2] = ['full_name' => 'Pedro Santos', 'relationship' => 'Relative', 'birthdate' => '1970-02-02', 'sex' => 'M'];
        $this->postJson('/api/resident/household/update-request', $dup)
            ->assertUnprocessable()->assertJsonValidationErrors('members.2.full_name');

        // Typo fix on the spouse's name: same birthdate, so it's an edit, not remove + add
        $fix = $this->payload(['purok' => 'Purok 1', 'address' => null]);
        $fix['members'] = [$fix['members'][0], ['full_name' => 'Maria Dela Cruz', 'relationship' => 'Spouse', 'birthdate' => '1987-01-10', 'sex' => 'F']];
        $this->postJson('/api/resident/household/update-request', $fix)
            ->assertCreated()
            ->assertJsonCount(0, 'summary.members_added')
            ->assertJsonCount(0, 'summary.members_removed')
            ->assertJsonPath('summary.members_edited.0.changes.0.before', 'Maria Cruz');
    }

    public function test_other_barangays_cannot_see_or_review_the_request(): void
    {
        Sanctum::actingAs($this->resident);
        $id = $this->postJson('/api/resident/household/update-request', $this->payload())->json('id');

        $elsewhere = Barangay::create(['name' => 'Sawat']);
        $otherAdmin = User::create(['name' => 'Other', 'email' => 'sawat@test.local', 'password' => 'Password123', 'role' => User::ROLE_BARANGAY_ADMIN, 'barangay_id' => $elsewhere->id]);

        Sanctum::actingAs($otherAdmin);
        $this->getJson('/api/barangay/update-requests')->assertJsonPath('total', 0);
        $this->getJson("/api/barangay/update-requests/{$id}")->assertNotFound();
        $this->postJson("/api/barangay/update-requests/{$id}/approve")->assertNotFound();
    }
}
