<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Distribution extends Model
{
    protected $fillable = [
        'distribution_event_id', 'household_id', 'relief_item_id', 'distributed_by', 'quantity',
        'verification_method', 'synced_from_offline', 'distributed_at',
    ];

    protected function casts(): array
    {
        return [
            'distributed_at' => 'datetime',
            'synced_from_offline' => 'boolean',
        ];
    }

    public function event()
    {
        return $this->belongsTo(DistributionEvent::class, 'distribution_event_id');
    }

    public function household()
    {
        return $this->belongsTo(Household::class);
    }

    public function item()
    {
        return $this->belongsTo(ReliefItem::class, 'relief_item_id');
    }

    public function personnel()
    {
        return $this->belongsTo(User::class, 'distributed_by');
    }
}
