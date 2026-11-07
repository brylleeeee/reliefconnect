<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

/**
 * One in-app notification for distribution staff (bell icon on the staff dashboard).
 * Saved in the notifications table, like ResidentAlert. Push to the phone can be added later as another channel.
 *
 * kind: schedule | started
 * link: the staff app screen to open when tapped, e.g. "/dashboard"
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