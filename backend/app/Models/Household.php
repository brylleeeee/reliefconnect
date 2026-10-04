<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

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

    /**
     * Dynamic QR: the QR carries the reference number plus a secret token.
     * A new token is made on every resident login (and by "Reset QR"), so older
     * QRs and screenshots stop working. The reference number never changes.
     */
    public const QR_PREFIX = 'RC';

    public function rotateQr(): void
    {
        $this->forceFill(['qr_secret' => Str::random(40)])->save();
    }

    /** What the resident's QR encodes, e.g. "RC:URB-2026-000094:k9Fq2x...". Null until approved. */
    public function qrValue(): ?string
    {
        if ($this->status !== 'approved' || ! $this->reference_number || ! $this->qr_secret) {
            return null;
        }

        return self::QR_PREFIX.':'.$this->reference_number.':'.$this->qr_secret;
    }

    public function barangay()
    {
        return $this->belongsTo(Barangay::class);
    }

    public function members()
    {
        return $this->hasMany(HouseholdMember::class)->orderBy('id');
    }

    public function documents()
    {
        return $this->hasMany(HouseholdDocument::class);
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
