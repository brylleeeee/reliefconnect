<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Distribution extends Model
{
    protected $fillable = [
        'household_id', 'relief_item_id', 'distributed_by', 'quantity',
        'verification_method', 'synced_from_offline', 'distributed_at',
    ];

    protected function casts(): array
    {
        return [
            'distributed_at' => 'datetime',
            'synced_from_offline' => 'boolean',
        ];
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
