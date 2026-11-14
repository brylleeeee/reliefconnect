<?php

namespace App\Notifications\Channels;

use App\Jobs\SendExpoPush;
use App\Models\User;
use App\Support\NotificationPreferences;
use Illuminate\Notifications\Notification;

/**
 * Delivers a notification to the user's phone as a push notification.
 * Only queues the sending, so the in-app (database) notification is never slowed down.
 */
class ExpoPushChannel
{
    public function send(object $notifiable, Notification $notification): void
    {
        if (empty($notifiable->expo_push_token) || ! method_exists($notification, 'toExpoPush')) {
            return; // this phone never registered, or the notification has no push version
        }

        // Account → Notification Preferences: skip types the user turned off (the bell still gets them)
        $kind = $notification->kind ?? null;
        if ($kind && $notifiable instanceof User && ! NotificationPreferences::wantsPush($notifiable, $kind)) {
            return;
        }

        SendExpoPush::dispatch($notifiable->id, $notification->toExpoPush($notifiable));
    }
}
