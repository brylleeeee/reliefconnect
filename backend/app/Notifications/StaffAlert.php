<?php

namespace App\Notifications;

use App\Notifications\Channels\ExpoPushChannel;
use Illuminate\Notifications\Notification;

/**
 * One notification for distribution staff: saved in the notifications table (bell on the staff dashboard)
 * and pushed to the staff member's phone, so it shows even when the app is closed.
 *
 * kind: schedule | started | report_resolved
 * link: the staff app screen to open when tapped, e.g. "/dashboard", "/assistant"
 */
class StaffAlert extends Notification
{
    public function __construct(
        public string $kind,
        public string $title,
        public string $body,
        public string $link = '/dashboard',
        public ?string $tag = null,
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
            'data' => ['link' => $this->link, 'kind' => $this->kind],
        ];
    }
}