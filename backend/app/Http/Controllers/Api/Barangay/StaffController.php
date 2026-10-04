<?php

namespace App\Http\Controllers\Api\Barangay;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Barangay Admin: the distribution staff (mobile scanner) accounts of their own barangay.
 * Staff log in to the mobile app with their username and the temporary password set here,
 * then change it themselves (tap your name > Change Password).
 */
class StaffController extends Controller
{
    public function index(Request $request)
    {
        $staff = User::where('role', User::ROLE_DISTRIBUTION)
            ->where('barangay_id', $this->barangayId($request))
            ->orderByDesc('is_active')->orderBy('name')
            ->get(['id', 'name', 'username', 'phone', 'is_active', 'created_at']);

        // Last time each staff phone talked to the server
        $lastSeen = DB::table('personal_access_tokens')
            ->where('tokenable_type', User::class)
            ->whereIn('tokenable_id', $staff->pluck('id'))
            ->groupBy('tokenable_id')
            ->selectRaw('tokenable_id, MAX(COALESCE(last_used_at, created_at)) as seen')
            ->pluck('seen', 'tokenable_id');

        return $staff->map(fn (User $u) => $u->only(['id', 'name', 'username', 'phone', 'is_active', 'created_at'])
            + ['last_active_at' => $lastSeen[$u->id] ?? null]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'username' => ['required', 'string', 'min:3', 'max:50', 'regex:/^[A-Za-z0-9._-]+$/', Rule::unique('users', 'username')],
            'phone' => ['nullable', 'regex:/^09\d{9}$/', Rule::unique('users', 'phone')],
            'password' => ['required', 'string', 'min:8', 'max:100'],
        ], [
            'username.unique' => 'That username is taken. Try adding the barangay, e.g. "btc.juan".',
            'username.regex' => 'Use only letters, numbers, dots, dashes and underscores (no spaces).',
            'phone.regex' => 'Enter an 11-digit mobile number starting with 09.',
            'phone.unique' => 'This mobile number already has an account.',
            'password.min' => 'The temporary password must be at least 8 characters.',
        ]);

        $user = User::create([
            'name' => trim($data['name']),
            'username' => strtolower($data['username']),
            'phone' => $data['phone'] ?? null,
            'password' => $data['password'], // hashed by the User model
            'role' => User::ROLE_DISTRIBUTION,
            'barangay_id' => $this->barangayId($request),
            'is_active' => true,
        ]);

        return response()->json($user->only(['id', 'name', 'username', 'phone', 'is_active']), 201);
    }

    /** Sets a new temporary password and logs the staff out of their phone. */
    public function resetPassword(Request $request, User $user)
    {
        $this->own($request, $user);
        $data = $request->validate(['password' => ['required', 'string', 'min:8', 'max:100']], [
            'password.min' => 'The temporary password must be at least 8 characters.',
        ]);

        $user->forceFill(['password' => $data['password']])->save();
        $user->tokens()->delete();

        return response()->json(['message' => "Password reset. Give {$user->name} the new temporary password."]);
    }

    /** Blocks login right away and logs the staff out of their phone. Their past releases are kept. */
    public function deactivate(Request $request, User $user)
    {
        $this->own($request, $user);
        $user->forceFill(['is_active' => false])->save();
        $user->tokens()->delete();

        return response()->json(['message' => "{$user->name} can no longer log in."]);
    }

    public function activate(Request $request, User $user)
    {
        $this->own($request, $user);
        $user->forceFill(['is_active' => true])->save();

        return response()->json(['message' => "{$user->name} can log in again."]);
    }

    private function barangayId(Request $request): int
    {
        abort_unless($request->user()->barangay_id, 403, 'Your account is not assigned to a barangay.');

        return (int) $request->user()->barangay_id;
    }

    /** Only this barangay's staff accounts can be changed here. */
    private function own(Request $request, User $user): void
    {
        abort_unless(
            $user->role === User::ROLE_DISTRIBUTION && (int) $user->barangay_id === $this->barangayId($request),
            404
        );
    }
}
