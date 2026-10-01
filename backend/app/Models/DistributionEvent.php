<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DistributionEvent extends Model
{
    protected $fillable = [
        'name', 'relief_item_id', 'quantity_per_household', 'distribute_by',
        'notes', 'status', 'closed_at', 'created_by',
    ];

    // Match the database defaults so a freshly created event knows its status
    protected $attributes = ['status' => 'open', 'quantity_per_household' => 1];

    protected function casts(): array
    {
        return [
            'distribute_by' => 'date:Y-m-d',
            'closed_at' => 'datetime',
        ];
    }

    public function item()
    {
        return $this->belongsTo(ReliefItem::class, 'relief_item_id');
    }

    public function barangayDistributions()
    {
        return $this->hasMany(BarangayDistribution::class);
    }

    public function distributions()
    {
        return $this->hasMany(Distribution::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Open events first, newest first. */
    public function scopeBoardOrder($query)
    {
        return $query->orderByRaw("FIELD(status, 'open', 'closed')")->latest();
    }

    public function forBarangay(int $barangayId): ?BarangayDistribution
    {
        return $this->barangayDistributions()->where('barangay_id', $barangayId)->first();
    }

    /**
     * Units of an item promised to barangays that haven't closed their distribution yet,
     * minus what they already claimed. Stops two events from counting on the same stock.
     */
    public static function reservedUnits(int $reliefItemId, ?int $exceptEventId = null): int
    {
        return (int) BarangayDistribution::query()
            ->with('event')
            ->whereIn('status', ['unscheduled', 'scheduled', 'ongoing'])
            ->whereHas('event', fn ($q) => $q
                ->where('relief_item_id', $reliefItemId)
                ->where('status', 'open')
                ->when($exceptEventId, fn ($q) => $q->where('id', '!=', $exceptEventId)))
            ->get()
            ->sum(fn (BarangayDistribution $bd) => max($bd->quota - $bd->claimedCount(), 0)
                * $bd->event->quantity_per_household);
    }
}
