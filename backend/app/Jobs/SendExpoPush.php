<?php

namespace App\Jobs;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Sends one push notification to a user's phone through the Expo Push Service,
 * which hands it to Firebase Cloud Messaging (FCM) so it shows even when the app is closed.
 * Runs on the queue worker: `php artisan queue:work`.
 */
class SendExpoPush implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function backoff(): array
    {
        return [10, 60];
    }

    /** @param array{title:string, body:string, data?:array} $message */
    public function __construct(public int $userId, public array $message) {}

    public function handle(): void
    {
        $user = User::find($this->userId);
        $token = $user?->expo_push_token;
        if (! $token) {
            return; // logged out or removed since this was queued
        }

        $payload = array_merge([
            'to' => $token,
            'sound' => 'default',      // plays the notification sound
            'priority' => 'high',      // wakes the phone / delivers immediately
            'channelId' => 'default',  // the Android channel created in mobile/src/lib/push.ts
        ], $this->message);

        $headers = ['Accept' => 'application/json'];
        if ($key = config('services.expo.access_token')) {
            $headers['Authorization'] = 'Bearer '.$key;
        }

        $res = Http::withHeaders($headers)
            ->timeout(15)
            ->post(config('services.expo.push_url'), $payload);

        if ($res->serverError() || $res->status() === 429) {
            $res->throw(); // retried by the queue
        }

        // Expo answers 200 even when the push itself failed; the result is in data.status
        $ticket = $res->json('data');
        $ticket = isset($ticket[0]) ? $ticket[0] : $ticket;

        if (($ticket['status'] ?? null) === 'error') {
            $error = $ticket['details']['error'] ?? 'unknown';

            if ($error === 'DeviceNotRegistered') {
                // App uninstalled or token expired: stop sending to it
                $user->forceFill(['expo_push_token' => null])->save();
            }

            Log::warning("Expo push failed for user {$this->userId}: {$error} - ".($ticket['message'] ?? ''));
        }
    }
}
