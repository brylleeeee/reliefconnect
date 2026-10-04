<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SosAlert extends Model
{
    protected $fillable = [
        'user_id', 'household_id', 'barangay_id', 'people_count', 'latitude', 'longitude', 'status', 'served_at',
        'message', 'distribution_id',
    ];

    protected function casts(): array
    {
        return ['served_at' => 'datetime', 'people_count' => 'integer', 'ai_points' => 'integer',
            'ai_severity' => 'integer', 'ai_scored_at' => 'datetime'];
    }

    public function barangay()
    {
        return $this->belongsTo(Barangay::class);
    }

    public function household()
    {
        return $this->belongsTo(Household::class);
    }
}
