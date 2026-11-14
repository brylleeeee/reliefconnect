<?php

namespace App\Support;

use App\Models\User;

/**
 * Which phone notifications a user wants (Account → Notification Preferences in the app).
 * Only phone pop-ups are filtered; the in-app bell list always gets everything.
 * Security notifications (new login, QR reset) can never be turned off.
 */
class NotificationPreferences
{
    /** Categories the user can turn off, in the order the app shows them. */
    public const CATEGORIES = ['distributions', 'announcements', 'household', 'sos', 'reports'];

    /** Which category each notification kind belongs to. Unknown kinds count as "household". */
    public static function categoryOf(string $kind): string
    {
        return match ($kind) {
            'schedule', 'started', 'reminder', 'ended' => 'distributions',
            'announcement' => 'announcements',
            'sos_received', 'sos_served' => 'sos',
            'report_resolved' => 'reports',
            'security' => 'security',
            default => 'household', // approved, rejected, eligible, released, update_approved, update_rejected
        };
    }

    /** The saved settings, filled in with the defaults (everything on). */
    public static function for(User $user): array
    {
        $saved = $user->notification_preferences ?? [];

        return [
            'enabled' => (bool) ($saved['enabled'] ?? true),
            'muted' => array_values(array_intersect(self::CATEGORIES, $saved['muted'] ?? [])),
        ];
    }

    /** Should this kind of notification pop up on the user's phone? */
    public static function wantsPush(User $user, string $kind): bool
    {
        $category = self::categoryOf($kind);
        if ($category === 'security') {
            return true; // always: someone else may be using the account
        }

        $prefs = self::for($user);

        return $prefs['enabled'] && ! in_array($category, $prefs['muted'], true);
    }
}
