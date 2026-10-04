<?php

namespace App\Services;

use App\Models\SosAlert;
use Carbon\CarbonInterface;

/**
 * Closes a barangay's pending SOS once relief goods were delivered there, so the AI ranking moves on
 * to the next barangay. Call it from the place where the Distribution module records a delivery.
 */
class SosCloser
{
    /**
     * Only SOS sent BEFORE the delivery are closed. An SOS sent after the delivery stays pending,
     * because it means the barangay needs help again.
     *
     * @return int number of SOS closed
     */
    public function closeForBarangay(int $barangayId, ?CarbonInterface $deliveredAt = null): int
    {
        return SosAlert::where('barangay_id', $barangayId)
            ->where('status', 'pending')
            ->where('created_at', '<=', $deliveredAt ?? now())
            ->update(['status' => 'served', 'served_at' => now()]);
    }
}
