<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\NotificationPreferences;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Account → Notification Preferences in the mobile app. */
class NotificationPreferenceController extends Controller
{
    public function show(Request $request)
    {
        return response()->json(NotificationPreferences::for($request->user()));
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'muted' => ['present', 'array'],
            'muted.*' => ['string', Rule::in(NotificationPreferences::CATEGORIES)],
        ]);

        $request->user()->forceFill([
            'notification_preferences' => [
                'enabled' => $data['enabled'],
                'muted' => array_values(array_unique($data['muted'])),
            ],
        ])->save();

        return response()->json(NotificationPreferences::for($request->user()->fresh()));
    }
}
