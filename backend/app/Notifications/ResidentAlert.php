<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

/**
 * One in-app notification for a resident (bell icon in the mobile app).
 * Saved in the notifications table. Push to the phone can be added later as another channel.
 *
 * kind: schedule | started | approved | rejected | released | eligible
 *       | sos_received | sos_served | reminder | security
 * link: the app screen to open when tapped, e.g. "/announcements", "/history", "/home"
 */
class ResidentAlert extends Notification
{
    public function __construct(
        public string $kind,
        public string $title,
        public string $body,
        public string $link,
        public ?string $tag = null, // marks one-time notifications, e.g. "bd:12" for a reminder
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return array_filter(
            ['kind' => $this->kind, 'title' => $this->title, 'body' => $this->body, 'link' => $this->link, 'tag' => $this->tag],
            fn ($v) => $v !== null,
        );
    }
}
