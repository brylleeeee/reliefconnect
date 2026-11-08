<?php

namespace App\Services;

use App\Models\BarangayDistribution;
use App\Models\User;
use App\Notifications\StaffAlert;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

/**
 * Decides which distribution staff get which in-app notification.
 * Like ResidentNotifier, a failed notification is logged and never stops the action that caused it.
 */
class StaffNotifier
{
    /** Barangay set (or changed) the date and venue of a distribution. */
    public function scheduled(BarangayDistribution $bd, bool $changed): void
    {
        $bd->loadMissing('event.item');
        $when = $bd->scheduled_at?->format('M j, Y g:i A');

        $this->send($bd->barangay_id, new StaffAlert(
            'schedule',
            $changed ? 'Distribution schedule changed' : 'New distribution scheduled',
            "{$bd->event->name}: {$when} at {$bd->venue}. {$bd->event->item->name} will be released.",
        ));
    }

    /** Claiming opened in the barangay: staff can start scanning. */
    public function started(BarangayDistribution $bd): void
    {
        $bd->loadMissing('event.item');

        $this->send($bd->barangay_id, new StaffAlert(
            'started',
            'Claiming is now open',
            "{$bd->event->name} is open at {$bd->venue}. Select it on your dashboard to start scanning.",
        ));
    }

    /** Sends to the active distribution staff of the barangay. */
    private function send(int $barangayId, StaffAlert $alert): void
    {
        try {
            $users = User::where('role', User::ROLE_DISTRIBUTION)
                ->where('barangay_id', $barangayId)
                ->where('is_active', true)
                ->get();

            if ($users->isNotEmpty()) {
                Notification::send($users, $alert);
            }
        } catch (\Throwable $e) {
            Log::warning("Staff notification '{$alert->kind}' failed: ".$e->getMessage());
        }
    }
}