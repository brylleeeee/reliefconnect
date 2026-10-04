<?php

namespace App\Support;

use App\Models\BarangayDistribution;
use App\Models\Distribution;

/**
 * Everything about one claim, for the "claim details" window on both admin portals:
 * who received it, what and how much, when, how it was verified, and who released it.
 */
class ClaimDetails
{
    public static function for(Distribution $d): array
    {
        $d->loadMissing(['household.barangay:id,name', 'household.members', 'item', 'personnel:id,name', 'event']);
        $h = $d->household;

        $day = $d->event
            ? BarangayDistribution::where('distribution_event_id', $d->event->id)
                ->where('barangay_id', $h->barangay_id)->first()
            : null;

        return [
            'id' => $d->id,
            'distributed_at' => $d->distributed_at,
            'recorded_at' => $d->created_at, // later than distributed_at when synced from offline
            'synced_from_offline' => $d->synced_from_offline,
            'verification_method' => $d->verification_method,
            'released_by' => $d->personnel?->name,
            'item' => [
                'name' => $d->item->name,
                'type' => $d->item->type,
                'unit' => $d->item->unit,
            ],
            'quantity' => $d->quantity,
            'quantity_label' => $d->item->describeQuantity($d->quantity),
            'event' => $d->event ? [
                'id' => $d->event->id,
                'name' => $d->event->name,
                'status' => $d->event->status,
            ] : null,
            'distribution_day' => $day ? [
                'scheduled_at' => $day->scheduled_at,
                'venue' => $day->venue,
                'status' => $day->status,
            ] : null,
            'household' => [
                'id' => $h->id,
                'reference_number' => $h->reference_number,
                'household_head' => $h->household_head,
                'barangay' => $h->barangay->name,
                'purok' => $h->purok,
                'address' => $h->address,
                'contact_number' => $h->contact_number,
                'registration_type' => $h->registration_type,
                'priority_level' => $h->priority_level,
                'priority_score' => $h->priority_score,
                'members' => $h->members->map(fn ($m) => [
                    'full_name' => $m->full_name,
                    'relationship' => $m->relationship,
                    'age' => $m->age,
                    'sex' => $m->sex,
                    'is_pwd' => (bool) $m->is_pwd,
                    'is_pregnant' => (bool) $m->is_pregnant,
                ]),
            ],
        ];
    }
}
