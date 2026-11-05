<?php

namespace App\Models;

use App\Support\PersonName;
use Illuminate\Database\Eloquent\Model;

class HouseholdMember extends Model
{
    protected $fillable = [
        'household_id', 'full_name', 'relationship', 'birthdate', 'sex', 'is_pwd', 'is_pregnant',
        'transfer_from_household_id',
    ];

    protected $hidden = ['name_key'];

    protected static function booted(): void
    {
        // The normalized name used to find the same person in other households (see PersonName)
        static::saving(fn (self $m) => $m->name_key = PersonName::key((string) $m->full_name));
    }

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

    /** The household this person is still listed in, until the barangay approves the move. */
    public function transferFrom()
    {
        return $this->belongsTo(Household::class, 'transfer_from_household_id');
    }
}
