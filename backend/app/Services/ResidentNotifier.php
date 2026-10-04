<?php

namespace App\Services;

use App\Models\BarangayDistribution;
use App\Models\Distribution;
use App\Models\DistributionEvent;
use App\Models\Household;
use App\Models\SosAlert;
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
    // Plain announcements are not sent here: the Announcements tab and its pop-up already
    // cover them. Notifications are only about the resident's own household.

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

    /**
     * A targeted event (seniors, PWD, infants, pregnant, solo parents) was created: only households
     * that qualify, in the covered barangays, are told how much they will receive.
     */
    public function eligibleForEvent(DistributionEvent $event): void
    {
        if (($event->eligibility ?? 'all') === 'all') {
            return; // everyone gets it; the barangay's schedule notification covers that
        }
        $event->loadMissing(['item', 'barangayDistributions']);

        try {
            $households = DistributionEvent::applyEligibility(Household::query(), $event->eligibility)
                ->whereIn('barangay_id', $event->barangayDistributions->pluck('barangay_id'))
                ->where('status', 'approved')
                ->whereNotNull('user_id')
                ->get();

            foreach ($households as $h) {
                $count = DistributionEvent::recipientsIn($event->eligibility, $h);
                $what = $event->item->describeQuantity($event->quantityFor($h));
                $for = $event->per_member
                    ? " ({$count} qualifying member".($count === 1 ? '' : 's').' in your household)'
                    : '';
                $this->send(Household::whereKey($h->id), new ResidentAlert('eligible', 'You qualify for relief aid',
                    "{$event->name}: {$what} of {$event->item->name}{$for}. Your barangay will announce the schedule.", '/home'));
            }
        } catch (\Throwable $e) {
            Log::warning('Eligible notification failed: '.$e->getMessage());
        }
    }

    /** SOS sent: confirm it reached the LGU and say where the barangay stands in line. */
    public function sosReceived(SosAlert $sos): void
    {
        $position = '';
        try {
            $rows = app(SosPrioritizer::class)->rank()['rows'];
            $row = $rows->firstWhere('id', $sos->barangay_id);
            if ($row) {
                $position = " Your barangay is #{$row['rank']} of {$rows->count()} barangays asking for relief goods.";
            }
        } catch (\Throwable) {
            // the ranking is a bonus; the confirmation still goes out
        }

        $this->send(Household::whereKey($sos->household_id), new ResidentAlert('sos_received', 'SOS received',
            "The LGU can see your household needs relief goods.{$position}", '/sos'));
    }

    /** The LGU marked the barangay as served: everyone whose SOS was waiting is told help is coming. */
    public function sosServed(array $householdIds, string $barangay): void
    {
        if (! $householdIds) {
            return;
        }
        $this->send(Household::whereIn('id', $householdIds), new ResidentAlert('sos_served', 'Relief is on the way',
            "The LGU is sending relief goods to Barangay {$barangay}. Watch for your barangay's announcement.", '/sos'));
    }

    /**
     * Reminder for eligible households that have not claimed yet, once per distribution.
     * Sent by the relief:remind-unclaimed command (runs every 30 minutes).
     *
     * @return int how many households were reminded
     */
    public function remindUnclaimed(BarangayDistribution $bd): int
    {
        $bd->loadMissing('event.item');
        $tag = "bd:{$bd->id}";

        $households = $this->eligible($bd)
            ->whereNotNull('user_id')
            ->whereDoesntHave('distributions', fn ($q) => $q->where('distribution_event_id', $bd->distribution_event_id))
            ->get(['id', 'user_id']);

        // Skip anyone already reminded for this distribution
        $already = \Illuminate\Notifications\DatabaseNotification::where('type', ResidentAlert::class)
            ->where('data', 'like', '%"tag":"'.$tag.'"%')
            ->pluck('notifiable_id')->all();
        $households = $households->reject(fn ($h) => in_array($h->user_id, $already));

        if ($households->isNotEmpty()) {
            $this->send(Household::whereIn('id', $households->pluck('id')), new ResidentAlert('reminder',
                "You haven't claimed yet",
                "{$bd->event->name} is being released at {$bd->venue}. Go before the barangay closes it and bring your QR code.",
                '/home', $tag));
        }

        return $households->count();
    }

    /** Logged in on another phone: the QR changed, so older phones and screenshots stop working. */
    public function newLogin(Household $h, ?string $device): void
    {
        $this->send(Household::whereKey($h->id), new ResidentAlert('security', 'New login on your account',
            'Your account was opened on '.($device ?: 'another phone').'. Your QR code changed, so the QR on any other phone no longer works. '
            .'If this was not you, change your password.', '/home'));
    }

    /** The barangay reset the household's QR (e.g. lost phone). */
    public function qrReset(Household $h): void
    {
        $this->send(Household::whereKey($h->id), new ResidentAlert('security', 'Your QR code was reset',
            'Your barangay reset your QR code. Log in again to get the new one; the old QR no longer works.', '/home'));
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
