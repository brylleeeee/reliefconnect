<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

/**
 * One in-app notification for a resident (bell icon in the mobile app).
 * Saved in the notifications table. Push to the phone can be added later as another channel.
 *
 * kind: announcement | schedule | started | approved | rejected | released
 * link: the app screen to open when tapped, e.g. "/announcements", "/history", "/home"
 */
class ResidentAlert extends Notification
{
    public function __construct(
        public string $kind,
        public string $title,
        public string $body,
        public string $link,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return ['kind' => $this->kind, 'title' => $this->title, 'body' => $this->body, 'link' => $this->link];
    }
}
