<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReliefItem extends Model
{
    protected $fillable = [
        'name', 'contents', 'unit', 'quantity_in_stock',
        'distributed_to_date', 'reorder_level', 'expiry_date',
    ];

    protected $appends = ['is_low_stock'];

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
