<?php

namespace App\Notifications;

use App\Notifications\Channels\ExpoPushChannel;
use Illuminate\Notifications\Notification;

/**
 * One notification for a resident: saved in the notifications table (bell icon in the mobile app)
 * and pushed to the resident's phone, so it shows even when the app is closed.
 *
 * kind: schedule | started | approved | rejected | released | eligible
 *       | sos_received | sos_served | reminder | security | update_approved | update_rejected | report_resolved
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
        return ['database', ExpoPushChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        return array_filter(
            ['kind' => $this->kind, 'title' => $this->title, 'body' => $this->body, 'link' => $this->link, 'tag' => $this->tag],
            fn ($v) => $v !== null,
        );
    }

    /** The phone notification: same title and text; tapping it opens the same screen as the bell. */
    public function toExpoPush(object $notifiable): array
    {
        return [
            'title' => $this->title,
            'body' => $this->body,
            'sound' => 'default',
            'channelId' => 'default',
            'data' => ['link' => $this->link, 'kind' => $this->kind],
        ];
    }
}