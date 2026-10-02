<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A barangay's part of a distribution event: its quota (set by the LGU)
 * and its distribution day (scheduled, started and closed by the barangay).
 */
class BarangayDistribution extends Model
{
    protected $fillable = [
        'distribution_event_id', 'barangay_id', 'quota', 'scheduled_at', 'venue',
        'status', 'started_at', 'closed_at', 'updated_by',
    ];

    // Match the database default so a freshly created row knows its status
    protected $attributes = ['status' => 'unscheduled'];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'started_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function event()
    {
        return $this->belongsTo(DistributionEvent::class, 'distribution_event_id');
    }

    public function barangay()
    {
        return $this->belongsTo(Barangay::class);
    }

    /** Claims recorded for households of this barangay in this event. */
    public function claimedCount(): int
    {
        return Distribution::where('distribution_event_id', $this->distribution_event_id)
            ->whereHas('household', fn ($q) => $q->where('barangay_id', $this->barangay_id))
            ->count();
    }
}
