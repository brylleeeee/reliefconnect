<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockMovement extends Model
{
    protected $fillable = ['relief_item_id', 'user_id', 'type', 'quantity', 'source', 'remarks'];

    public function item()
    {
        return $this->belongsTo(ReliefItem::class, 'relief_item_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
