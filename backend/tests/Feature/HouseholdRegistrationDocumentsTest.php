<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Registering a household from the app: only a valid ID is required (no birth certificate).
 * Run with: php artisan test --filter=HouseholdRegistrationDocumentsTest
 */
class HouseholdRegistrationDocumentsTest extends TestCase
{
    use RefreshDatabase;

    // A real 1x1 PNG, so the server's photo type check passes
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    private function payload(array $extra = []): array
    {
        $brgy = Barangay::firstOrCreate(['name' => 'Bayaoas']);

        return [
            'barangay_id' => $brgy->id,
            'purok' => 'Purok 3',
            'address' => 'Sitio North',
            'members' => [
                ['full_name' => 'Juan Dela Cruz', 'relationship' => 'Head', 'birthdate' => '1985-04-23', 'sex' => 'M'],
            ],
        ] + $extra;
    }

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Sanctum::actingAs(User::create(['name' => 'Juan', 'phone' => '09170000081', 'password' => 'Password123', 'role' => User::ROLE_RESIDENT]));
    }

    public function test_a_valid_id_alone_is_enough(): void
    {
        $this->postJson('/api/resident/household', $this->payload(['valid_id_base64' => self::PNG]))
            ->assertCreated();

        $this->assertDatabaseHas('household_documents', ['type' => 'valid_id']);
        $this->assertDatabaseMissing('household_documents', ['type' => 'birth_certificate']);
    }

    public function test_the_valid_id_is_still_required(): void
    {
        $this->postJson('/api/resident/household', $this->payload())
            ->assertStatus(422)
            ->assertJsonValidationErrors('valid_id_base64');
    }
}
