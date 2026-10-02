<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HouseholdMember extends Model
{
    protected $fillable = [
        'household_id', 'full_name', 'relationship', 'birthdate', 'sex', 'is_pwd', 'is_pregnant',
    ];

    protected $appends = ['age'];

    protected function casts(): array
    {
        return [
            'birthdate' => 'date:Y-m-d',
            'is_pwd' => 'boolean',
            'is_pregnant' => 'boolean',
        ];
    }

    public function getAgeAttribute(): int
    {
        return $this->birthdate ? $this->birthdate->age : 0;
    }

    public function household()
    {
        return $this->belongsTo(Household::class);
    }
}
