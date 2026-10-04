<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReliefItem extends Model
{
    protected $fillable = [
        'type', 'name', 'contents', 'unit', 'quantity_in_stock',
        'distributed_to_date', 'reorder_level', 'expiry_date',
    ];

    protected $appends = ['is_low_stock'];

    // Match the database default so a freshly created item knows its type
    protected $attributes = ['type' => 'goods'];

    public function scopeGoods($q)
    {
        return $q->where('type', 'goods');
    }

    public function scopeCash($q)
    {
        return $q->where('type', 'cash');
    }

    public function isCash(): bool
    {
        return $this->type === 'cash';
    }

    /** "₱1,000 cash" or "1 Pack" / "3 Packs" of this item, for messages and reports. */
    public function describeQuantity(int $qty): string
    {
        if ($this->isCash()) {
            return '₱'.number_format($qty).' cash';
        }
        $singular = config('relief.units')[$this->unit] ?? \Illuminate\Support\Str::singular($this->unit);

        return $qty.' '.($qty === 1 ? $singular : $this->unit);
    }

    protected function casts(): array
    {
        return ['expiry_date' => 'date:Y-m-d'];
    }

    public function getIsLowStockAttribute(): bool
    {
        return $this->quantity_in_stock <= $this->reorder_level;
    }

    public function movements()
    {
        return $this->hasMany(StockMovement::class);
    }
}
