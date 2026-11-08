<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

/** Mobile app: save the phone's Expo push token after login, remove it on logout. */
class PushTokenController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:255', 'regex:/^Expo(nent)?PushToken\[.+\]$/'],
        ]);

        // A shared phone: the previous user on this phone stops receiving its pushes
        User::where('expo_push_token', $data['token'])
            ->where('id', '!=', $request->user()->id)
            ->update(['expo_push_token' => null]);

        $request->user()->forceFill(['expo_push_token' => $data['token']])->save();

        return response()->json(['message' => 'This phone will receive notifications.']);
    }

    public function destroy(Request $request)
    {
        $request->user()->forceFill(['expo_push_token' => null])->save();

        return response()->json(['message' => 'This phone will no longer receive notifications.']);
    }
}