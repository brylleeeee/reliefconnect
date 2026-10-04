<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Change password for residents and staff.
 * Run with: php artisan test --filter=ChangePasswordTest
 */
class ChangePasswordTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Ana Reyes', 'phone' => '09170000001', 'password' => 'OldPass123', 'role' => User::ROLE_RESIDENT,
        ]);
    }

    public function test_password_changes_and_other_devices_are_logged_out(): void
    {
        $thisPhone = $this->user->createToken('this-phone')->plainTextToken;
        $this->user->createToken('other-phone');

        $this->withToken($thisPhone)->postJson('/api/me/password', [
            'current_password' => 'OldPass123',
            'password' => 'NewPass456',
            'password_confirmation' => 'NewPass456',
        ])->assertOk();

        $this->assertTrue(Hash::check('NewPass456', $this->user->fresh()->password));
        $this->assertSame(['this-phone'], $this->user->tokens()->pluck('name')->all());
    }

    public function test_new_password_works_for_login_and_old_one_does_not(): void
    {
        $this->withToken($this->user->createToken('t')->plainTextToken)->postJson('/api/me/password', [
            'current_password' => 'OldPass123', 'password' => 'NewPass456', 'password_confirmation' => 'NewPass456',
        ])->assertOk();

        $this->postJson('/api/login', ['login' => '09170000001', 'password' => 'OldPass123'])->assertUnprocessable();
        $this->postJson('/api/login', ['login' => '09170000001', 'password' => 'NewPass456'])->assertOk();
    }

    public function test_wrong_current_password_is_rejected(): void
    {
        $this->withToken($this->user->createToken('t')->plainTextToken)->postJson('/api/me/password', [
            'current_password' => 'WrongPass',
            'password' => 'NewPass456',
            'password_confirmation' => 'NewPass456',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

        $this->assertTrue(Hash::check('OldPass123', $this->user->fresh()->password));
    }

    public function test_new_password_must_be_confirmed_long_enough_and_different(): void
    {
        $token = $this->user->createToken('t')->plainTextToken;
        $send = fn (array $body) => $this->withToken($token)->postJson('/api/me/password', $body + ['current_password' => 'OldPass123']);

        $send(['password' => 'short', 'password_confirmation' => 'short'])->assertJsonValidationErrors('password');
        $send(['password' => 'NewPass456', 'password_confirmation' => 'Mismatch99'])->assertJsonValidationErrors('password');
        $send(['password' => 'OldPass123', 'password_confirmation' => 'OldPass123'])->assertJsonValidationErrors('password');
    }

    public function test_must_be_logged_in(): void
    {
        $this->postJson('/api/me/password', [])->assertUnauthorized();
    }
}
