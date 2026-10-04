<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Household;
use App\Models\User;
use App\Services\DistributionEventService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Exceptions\HttpResponseException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Dynamic QR: a new QR on every resident login; the reference number never changes.
 * Run with: php artisan test --filter=DynamicQrTest
 */
class DynamicQrTest extends TestCase
{
    use RefreshDatabase;

    private Barangay $barangay;
    private User $resident;
    private Household $household;

    protected function setUp(): void
    {
        parent::setUp();

        $this->barangay = Barangay::create(['name' => 'Batangcaoa']);
        $this->resident = User::create([
            'name' => 'Ana Reyes', 'phone' => '09170000001', 'password' => 'Password123',
            'role' => User::ROLE_RESIDENT, 'barangay_id' => $this->barangay->id,
        ]);
        $this->household = Household::create([
            'user_id' => $this->resident->id, 'barangay_id' => $this->barangay->id,
            'household_head' => 'Ana Reyes', 'reference_number' => 'URB-2026-000094',
            'status' => 'approved', 'approved_at' => now(),
        ]);
        $this->household->rotateQr();
    }

    private function login(): string
    {
        $this->postJson('/api/login', [
            'login' => '09170000001', 'password' => 'Password123', 'device_name' => 'test',
        ])->assertOk();

        return $this->household->fresh()->qrValue();
    }

    public function test_every_login_gives_a_new_qr_but_the_same_reference_number(): void
    {
        $first = $this->login();
        $second = $this->login();

        $this->assertNotSame($first, $second);
        $this->assertStringStartsWith('RC:URB-2026-000094:', $first);
        $this->assertStringStartsWith('RC:URB-2026-000094:', $second);
        $this->assertSame('URB-2026-000094', $this->household->fresh()->reference_number);
    }

    public function test_resident_app_receives_the_current_qr(): void
    {
        $qr = $this->login();

        Sanctum::actingAs($this->resident);
        $this->getJson('/api/resident/household')
            ->assertOk()
            ->assertJsonPath('qr_value', $qr)
            ->assertJsonPath('reference_number', 'URB-2026-000094')
            ->assertJsonMissingPath('qr_secret');
    }

    public function test_only_the_latest_qr_is_accepted_by_the_scanner(): void
    {
        $service = app(DistributionEventService::class);
        $old = $this->login();
        $new = $this->login(); // e.g. resident logged in on another phone

        $this->assertSame('URB-2026-000094', $service->referenceFromQr($new));
        $this->assertQrRejected($service, $old, 'qr_expired');
    }

    public function test_plain_reference_numbers_and_other_qrs_are_rejected_as_qr(): void
    {
        $service = app(DistributionEventService::class);

        $this->assertQrRejected($service, 'URB-2026-000094', 'invalid_qr');        // old static QR
        $this->assertQrRejected($service, 'https://example.com', 'invalid_qr');
        $this->assertQrRejected($service, 'RC:URB-2026-000094:wrongtoken', 'qr_expired');
    }

    public function test_barangay_admin_can_reset_qr(): void
    {
        $qr = $this->login();
        $admin = User::create([
            'name' => 'Brgy Admin', 'email' => 'admin@test.local', 'password' => 'Password123',
            'role' => User::ROLE_BARANGAY_ADMIN, 'barangay_id' => $this->barangay->id,
        ]);

        Sanctum::actingAs($admin);
        $this->postJson("/api/barangay/households/{$this->household->id}/reset-qr")
            ->assertOk();

        $this->assertNotSame($qr, $this->household->fresh()->qrValue());
        $this->assertQrRejected(app(DistributionEventService::class), $qr, 'qr_expired');
    }

    public function test_admin_of_another_barangay_cannot_reset_qr(): void
    {
        $other = Barangay::create(['name' => 'Poblacion']);
        $admin = User::create([
            'name' => 'Other Admin', 'email' => 'other@test.local', 'password' => 'Password123',
            'role' => User::ROLE_BARANGAY_ADMIN, 'barangay_id' => $other->id,
        ]);

        Sanctum::actingAs($admin);
        $this->postJson("/api/barangay/households/{$this->household->id}/reset-qr")
            ->assertNotFound();
    }

    private function assertQrRejected(DistributionEventService $service, string $qr, string $code): void
    {
        try {
            $service->referenceFromQr($qr);
            $this->fail("QR \"{$qr}\" should have been rejected.");
        } catch (HttpResponseException $e) {
            $this->assertSame($code, $e->getResponse()->getData(true)['code']);
        }
    }
}
