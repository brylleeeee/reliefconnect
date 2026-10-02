<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Household extends Model
{
    protected $fillable = [
        'user_id', 'barangay_id', 'household_head', 'purok', 'address', 'contact_number',
        'members_count', 'seniors_count', 'pwd_count', 'infants_count', 'pregnant_count',
        'is_solo_parent', 'priority_score', 'priority_level',
        'reference_number', 'status', 'rejection_reason', 'approved_at', 'registration_type',
    ];

    protected $hidden = ['qr_secret'];

    protected function casts(): array
    {
        return [
            'approved_at' => 'datetime',
            'is_solo_parent' => 'boolean',
            'qr_secret' => 'encrypted',
        ];
    }

    public function barangay()
    {
        return $this->belongsTo(Barangay::class);
    }

    public function members()
    {
        return $this->hasMany(HouseholdMember::class)->orderBy('id');
    }

    public function distributions()
    {
        return $this->hasMany(Distribution::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
