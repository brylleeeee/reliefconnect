<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Barangay extends Model
{
    protected $fillable = ['name', 'latitude', 'longitude'];

    public function households()
    {
        return $this->hasMany(Household::class);
    }
}
