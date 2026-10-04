<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Where relief goods or cash came from: a donation, the LGU's own funds, or a government allocation. */
class Source extends Model
{
    public const TYPES = [
        'donation' => 'Donation',
        'lgu_fund' => 'LGU fund',
        'government_allocation' => 'Government allocation',
    ];

    protected $fillable = ['name', 'type'];

    protected $attributes = ['type' => 'donation'];

    protected $appends = ['type_label'];

    public function getTypeLabelAttribute(): string
    {
        return self::TYPES[$this->type] ?? 'Donation';
    }

    public function received()
    {
        return $this->hasMany(StockMovement::class)->where('type', 'incoming');
    }
}
