<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A person or organization that gives relief goods or cash to the LGU. */
class Donor extends Model
{
    protected $fillable = ['name'];

    public function donations()
    {
        return $this->hasMany(StockMovement::class)->where('type', 'incoming');
    }
}
