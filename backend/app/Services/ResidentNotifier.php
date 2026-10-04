<?php

namespace App\Services;

use App\Models\Announcement;
use App\Models\BarangayDistribution;
use App\Models\Distribution;
use App\Models\DistributionEvent;
use App\Models\Household;
use App\Models\User;
use App\Notifications\ResidentAlert;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

/**
 * Decides which residents get which in-app notification.
 * A failed notification is logged and never stops the action that caused it
 * (an announcement is still posted, a claim is still recorded).
 */
class ResidentNotifier
{
    /** Barangay announcement: every resident with a household in that barangay. */
    public function announcement(Announcement $a): void
    {
        $this->send(
            Household::where('barangay_id', $a->barangay_id),
            new ResidentAlert('announcement', 'New announcement', $a->title, '/announcements'),
        );
    }

    /** Barangay set (or changed) the date and venue: approved households that can receive in this event. */
    public function scheduled(BarangayDistribution $bd, bool $changed): void
    {
        $bd->loadMissing('event.item');
        $when = $bd->scheduled_at?->format('M j, Y g:i A');

        $this->send(
            $this->eligible($bd),
            new ResidentAlert(
                'schedule',
                $changed ? 'Distribution schedule changed' : 'Distribution scheduled',
                "{$bd->event->name}: {$when} at {$bd->venue}. Bring your QR or reference number.",
                '/home',
            ),
        );
    }

    /** Claiming opened in the barangay. */
    public function started(BarangayDistribution $bd): void
    {
        $bd->loadMissing('event.item');

        $this->send(
            $this->eligible($bd),
            new ResidentAlert(
                'started',
                'Distribution has started',
                "{$bd->event->name} is now being released at {$bd->venue}. Show your QR code (on Home) to the staff.",
                '/home',
            ),
        );
    }

    /** The barangay approved or rejected the resident's household. Walk-ins have no account yet, so they are skipped. */
    public function reviewed(Household $h): void
    {
        $alert = $h->status === 'approved'
            ? new ResidentAlert('approved', 'Household approved',
                "Your reference number is {$h->reference_number}. Your QR code is ready.", '/home')
            : new ResidentAlert('rejected', 'Household not approved',
                ($h->rejection_reason ?: 'Please check your details.').' You can correct and resubmit.', '/home');

        $this->send(Household::whereKey($h->id), $alert);
    }

    /** Aid was released to the household (also when an offline release syncs). */
    public function released(Distribution $d): void
    {
        $d->loadMissing(['item', 'event']);
        $what = $d->item->describeQuantity($d->quantity); // "1 Pack" or "₱1,000 cash"

        $this->send(
            Household::whereKey($d->household_id),
            new ResidentAlert('released', 'Aid received', "{$what} of {$d->item->name}"
                .($d->event ? " ({$d->event->name})" : '').' was recorded for your household.', '/history'),
        );
    }

    private function eligible(BarangayDistribution $bd): Builder
    {
        return DistributionEvent::applyEligibility(Household::query(), $bd->event->eligibility ?? 'all')
            ->where('barangay_id', $bd->barangay_id)
            ->where('status', 'approved');
    }

    /** Sends to the resident accounts of the given households. */
    private function send(Builder $households, ResidentAlert $alert): void
    {
        try {
            $users = User::where('role', User::ROLE_RESIDENT)
                ->whereIn('id', $households->whereNotNull('user_id')->select('user_id'))
                ->get();

            if ($users->isNotEmpty()) {
                Notification::send($users, $alert);
            }
        } catch (\Throwable $e) {
            Log::warning("Resident notification '{$alert->kind}' failed: ".$e->getMessage());
        }
    }
}
