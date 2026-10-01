<?php

namespace App\Services;

use App\Models\Distribution;
use App\Models\DistributionEvent;
use App\Models\Household;
use App\Models\ReliefItem;
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
            $bd === null => "This event does not cover Barangay {$brgy}.",
            (bool) $claim => 'This household already claimed for this event.',
            $bd->status === 'closed' => "Barangay {$brgy} has closed its distribution.",
            $bd->status !== 'ongoing' => "Barangay {$brgy} has not started its distribution.",
            $bd->claimedCount() >= $bd->quota => "Barangay {$brgy} has reached its quota.",
            default => null,
        };

        return [
            'household' => $household->only([
                'id', 'reference_number', 'household_head', 'purok', 'members_count', 'priority_level',
            ]) + ['barangay' => $brgy],
            'can_claim' => $problem === null,
            'reason' => $problem,
            'claimed_at' => $claim?->distributed_at,
            'quantity' => $event->quantity_per_household,
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
            return DB::transaction(function () use ($event, $household, $by, $options, $bd, $brgy, $offline) {
                // Locking the item row makes simultaneous claims wait their turn,
                // so the quota and stock checks below can't both pass for two scanners.
                $item = ReliefItem::lockForUpdate()->findOrFail($event->relief_item_id);
                $qty = $event->quantity_per_household;

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

                return $distribution;
            });
        } catch (QueryException $e) {
            // 1062 = duplicate key: another scanner saved this household a moment earlier
            if (($e->errorInfo[1] ?? null) === 1062) {
                $this->fail('already_claimed', 'This household already claimed for this event.');
            }
            throw $e;
        }
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

    /** JSON error with a short code the mobile app can switch on. */
    private function fail(string $code, string $message, int $status = 409): never
    {
        throw new HttpResponseException(response()->json(['message' => $message, 'code' => $code], $status));
    }
}
