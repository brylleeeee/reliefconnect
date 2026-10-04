<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Household;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    /**
     * One login for every app: admins send an email (web), residents their mobile number,
     * distribution staff their username (mobile). The web portal still sends "email".
     */
    public function login(Request $request)
    {
        $data = $request->validate([
            'login' => ['required_without:email', 'nullable', 'string', 'max:255'],
            'email' => ['required_without:login', 'nullable', 'string', 'max:255'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $field = isset($data['login']) ? 'login' : 'email';
        $id = trim($data[$field]);

        $user = User::with('barangay')
            ->where(fn ($q) => $q->where('email', $id)->orWhere('phone', $id)->orWhere('username', $id))
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                $field => 'The login details or password are incorrect.',
            ]);
        }

        // Deactivated by the barangay admin (e.g. a staff volunteer who left)
        if ($user->is_active === false) {
            throw ValidationException::withMessages([
                $field => 'This account is deactivated. Please contact your barangay.',
            ]);
        }

        // Token abilities mirror the role
        $token = $user->createToken($data['device_name'] ?? 'admin-web', [$user->role])->plainTextToken;

        // Dynamic QR: every resident login issues a new QR, so the QR on any other phone
        // (or in a screenshot) stops working. Only the latest login's QR is valid.
        if ($user->role === User::ROLE_RESIDENT) {
            Household::where('user_id', $user->id)->where('status', 'approved')->latest('id')->first()?->rotateQr();
        }

        return response()->json(['token' => $token, 'user' => $user]);
    }

    /** Resident sign-up from the mobile app. The household is submitted separately. */
    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'phone' => ['required', 'regex:/^09\d{9}$/', 'unique:users,phone'],
            'password' => ['required', 'string', 'min:8', 'max:100'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ], [
            'phone.regex' => 'Enter an 11-digit mobile number starting with 09.',
            'phone.unique' => 'This mobile number is already registered. Log in instead.',
        ]);

        $user = User::create([
            'name' => trim($data['name']),
            'phone' => $data['phone'],
            'password' => $data['password'],
            'role' => User::ROLE_RESIDENT,
        ]);

        $token = $user->createToken($data['device_name'] ?? 'resident-app', [$user->role])->plainTextToken;

        return response()->json(['token' => $token, 'user' => $user], 201);
    }

    /**
     * Change password (any role). Needs the current password. Other phones and browsers
     * logged in to this account are logged out, so an old or shared password stops working
     * everywhere; this device stays logged in.
     */
    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => ['required', 'string', 'current_password:sanctum'],
            'password' => ['required', 'string', 'min:8', 'max:100', 'confirmed', 'different:current_password'],
        ], [
            'current_password.current_password' => 'Your current password is incorrect.',
            'password.min' => 'The new password must be at least 8 characters.',
            'password.confirmed' => 'The new passwords do not match.',
            'password.different' => 'Choose a new password that is different from your current one.',
        ]);

        $user = $request->user();
        $user->forceFill(['password' => $request->input('password')])->save(); // hashed by the User model

        $current = $user->currentAccessToken();
        $user->tokens()
            ->when($current instanceof PersonalAccessToken, fn ($q) => $q->where('id', '!=', $current->id))
            ->delete();

        return response()->json(['message' => 'Password changed. Other devices were logged out.']);
    }

    public function me(Request $request)
    {
        return $request->user()->load('barangay');
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }
}
