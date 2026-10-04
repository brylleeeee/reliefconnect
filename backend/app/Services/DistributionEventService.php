<?php

namespace App\Services;

use App\Models\Distribution;
use App\Models\DistributionEvent;
use App\Models\Household;
use App\Models\ReliefItem;
use App\Models\SosAlert;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Records a household's claim during a distribution event.
 * Called by the Distribution Personnel (mobile) endpoints, and by the seeder for sample data.
 */
class DistributionEventService
{
    /**
     * Looks up a household by reference number and says whether it can claim now.
     * Lets the scanner show the household before the staff confirms the release.
     */
    public function check(DistributionEvent $event, string $referenceNumber): array
    {
        $household = $this->findHousehold($referenceNumber);
        $claim = $event->distributions()->where('household_id', $household->id)->first();
        $bd = $event->forBarangay($household->barangay_id);
        $brgy = $household->barangay->name;

        $problem = match (true) {
            $event->status !== 'open' => 'This event is closed.',
            $household->status !== 'approved' => 'This household is not approved yet.',
            $event->quantityFor($household) === 0 => $this->notEligibleMessage($event),
            $bd === null => "This event does not cover Barangay {$brgy}.",
            (bool) $claim => 'This household already claimed for this event.',
            $bd->status === 'closed' => "Barangay {$brgy} has closed its distribution.",
            $bd->status !== 'ongoing' => "Barangay {$brgy} has not started its distribution.",
            $bd->claimedCount() >= $bd->quota => "Barangay {$brgy} has reached its quota.",
            default => null,
        };

        $sos = SosAlert::where('household_id', $household->id)->where('status', 'pending')->latest('id')->first();

        return [
            'household' => $household->only([
                'id', 'reference_number', 'household_head', 'purok', 'members_count', 'priority_level',
            ]) + ['barangay' => $brgy],
            // This household pressed SOS and is waiting: serve it first
            'sos' => $sos ? ['message' => $sos->message, 'reason' => $sos->ai_reason, 'sent_at' => $sos->created_at] : null,
            'can_claim' => $problem === null,
            'reason' => $problem,
            'claimed_at' => $claim?->distributed_at,
            'quantity' => $event->quantityFor($household), // per qualifying member for member rules
            'eligibility' => $event->eligibility_label,
            'unit' => $event->item->unit,
        ];
    }

    /**
     * $options: verification_method ('qr'|'reference_number'), synced_from_offline (bool),
     *           distributed_at (string, for claims recorded offline)
     */
    public function claim(DistributionEvent $event, string $referenceNumber, User $by, array $options = []): Distribution
    {
        $offline = (bool) ($options['synced_from_offline'] ?? false);
        $household = $this->findHousehold($referenceNumber);

        $brgy = $household->barangay->name;
        $bd = $event->forBarangay($household->barangay_id);

        if ($household->status !== 'approved') {
            $this->fail('not_approved', 'This household is not approved yet.');
        }
        if ($event->quantityFor($household) === 0) {
            $this->fail('not_eligible', $this->notEligibleMessage($event));
        }
        if ($bd === null) {
            $this->fail('wrong_barangay', "This event does not cover Barangay {$brgy}.");
        }
        // Online claims need the barangay's distribution to be running. Offline claims were
        // recorded while it was running, so they are still accepted after it closes.
        $running = $event->status === 'open' && $bd->status === 'ongoing';
        $closedLater = $bd->status === 'ongoing' || ($bd->status === 'closed' && $bd->started_at !== null);
        if (! ($offline ? $closedLater : $running)) {
            $this->fail('not_started', match (true) {
                $event->status === 'closed' => 'This event is closed.',
                $bd->status === 'closed' => "Barangay {$brgy} has closed its distribution.",
                default => "Barangay {$brgy} has not started its distribution.",
            });
        }

        try {
            $distribution = DB::transaction(function () use ($event, $household, $by, $options, $bd, $brgy, $offline) {
                // Locking the item row makes simultaneous claims wait their turn,
                // so the quota and stock checks below can't both pass for two scanners.
                $item = ReliefItem::lockForUpdate()->findOrFail($event->relief_item_id);
                // e.g. 1 kit per senior: a household with 2 seniors receives 2
                $qty = $event->quantityFor($household);

                if ($event->distributions()->where('household_id', $household->id)->exists()) {
                    $this->fail('already_claimed', 'This household already claimed for this event.');
                }
                if (! $offline && $bd->claimedCount() >= $bd->quota) {
                    $this->fail('quota_reached', "Barangay {$brgy} has reached its quota.");
                }
                if (! $offline && $item->quantity_in_stock < $qty) {
                    $this->fail('out_of_stock', "Only {$item->quantity_in_stock} {$item->unit} left in stock.");
                }

                $distribution = Distribution::create([
                    'distribution_event_id' => $event->id,
                    'household_id' => $household->id,
                    'relief_item_id' => $item->id,
                    'distributed_by' => $by->id,
                    'quantity' => $qty,
                    'verification_method' => $options['verification_method'] ?? 'reference_number',
                    'synced_from_offline' => $offline,
                    'distributed_at' => isset($options['distributed_at'])
                        ? Carbon::parse($options['distributed_at']) : now(),
                ]);

                // Goods physically left, so stock follows even for late offline claims.
                $item->quantity_in_stock = max($item->quantity_in_stock - $qty, 0);
                $item->distributed_to_date += $qty;
                $item->save();

                StockMovement::create([
                    'relief_item_id' => $item->id,
                    'user_id' => $by->id,
                    'type' => 'distribution',
                    'quantity' => -$qty,
                    'remarks' => "{$event->name}: {$household->reference_number}",
                ]);

                // The household received its goods: its SOS (sent before this claim) is served, so it stops
                // counting in SOS and Aid Prioritization and the ranking moves on to the next barangay.
                SosAlert::where('household_id', $household->id)->where('status', 'pending')
                    ->where('created_at', '<=', $distribution->distributed_at)
                    ->update(['status' => 'served', 'served_at' => now(), 'distribution_id' => $distribution->id]);

                return $distribution;
            });

            app(ResidentNotifier::class)->released($distribution); // bell in the resident app

            return $distribution;
        } catch (QueryException $e) {
            // 1062 = duplicate key: another scanner saved this household a moment earlier
            if (($e->errorInfo[1] ?? null) === 1062) {
                $this->fail('already_claimed', 'This household already claimed for this event.');
            }
            throw $e;
        }
    }

    /**
     * Offline mode: everything a staff phone needs to check reference numbers without internet,
     * for one barangay's running distribution. Only households that can receive in this event
     * are included, with whether they already claimed. QR secrets are never included, so QR
     * scanning stays online-only. The phone deletes this list when the distribution closes.
     */
    public function offlinePack(DistributionEvent $event, int $barangayId): array
    {
        $bd = $event->forBarangay($barangayId);

        if ($event->status !== 'open' || ! $bd || $bd->status !== 'ongoing') {
            $this->fail('not_started', 'This barangay distribution is not running, so there is nothing to download.');
        }

        $claimed = $event->distributions()
            ->whereHas('household', fn ($q) => $q->where('barangay_id', $barangayId))
            ->pluck('distributed_at', 'household_id');

        $households = DistributionEvent::applyEligibility(Household::query(), $event->eligibility ?? 'all')
            ->where('barangay_id', $barangayId)
            ->where('status', 'approved')
            ->whereNotNull('reference_number')
            ->orderBy('reference_number')
            ->get(['id', 'reference_number', 'household_head', 'purok', 'members_count', 'priority_level',
                'seniors_count', 'pwd_count', 'infants_count', 'pregnant_count', 'is_solo_parent'])
            ->map(fn (Household $h) => [
                'reference_number' => $h->reference_number,
                'household_head' => $h->household_head,
                'purok' => $h->purok,
                'members_count' => $h->members_count,
                'priority_level' => $h->priority_level,
                'quantity' => $event->quantityFor($h),
                'claimed_at' => $claimed[$h->id] ?? null,
            ])
            ->filter(fn ($h) => $h['quantity'] > 0)
            ->values();

        return [
            'event_id' => $event->id,
            'barangay_id' => $barangayId,
            'unit' => $event->item->unit,
            'quota' => $bd->quota,
            'claimed' => $claimed->count(),
            'downloaded_at' => now()->toIso8601String(),
            'households' => $households,
        ];
    }

    /**
     * Dynamic QR: reads a scanned "RC:<reference number>:<token>" and returns the reference
     * number, but only if the token is the one issued at the resident's latest login.
     * QR scans are always checked online; offline, staff use manual reference number entry.
     */
    public function referenceFromQr(string $qr): string
    {
        $parts = explode(':', trim($qr), 3);

        if (count($parts) !== 3 || $parts[0] !== Household::QR_PREFIX || $parts[2] === '') {
            $this->fail('invalid_qr', 'This is not a ReliefConnect QR code.', 422);
        }

        $household = $this->findHousehold($parts[1]);

        if (! $household->qr_secret || ! hash_equals($household->qr_secret, $parts[2])) {
            $this->fail('qr_expired', 'This QR is no longer valid. Ask the resident to log in to the app again and show the new QR, or use manual entry.', 422);
        }

        return $household->reference_number;
    }

    private function findHousehold(string $referenceNumber): Household
    {
        $household = Household::with('barangay')
            ->where('reference_number', strtoupper(trim($referenceNumber)))
            ->first();

        if (! $household) {
            $this->fail('not_found', 'No household has this reference number.', 404);
        }

        return $household;
    }

    private function notEligibleMessage(DistributionEvent $event): string
    {
        return 'This event is only for '.lcfirst($event->eligibility_label).'.';
    }

    /** JSON error with a short code the mobile app can switch on. */
    private function fail(string $code, string $message, int $status = 409): never
    {
        throw new HttpResponseException(response()->json(['message' => $message, 'code' => $code], $status));
    }
}
