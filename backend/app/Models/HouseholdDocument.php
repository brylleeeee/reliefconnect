<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HouseholdDocument extends Model
{
    public const TYPES = ['valid_id' => 'Valid ID', 'birth_certificate' => 'Birth Certificate'];

    protected $fillable = ['household_id', 'type', 'path', 'original_name', 'mime_type', 'size'];

    // The storage path is internal; files are only served through an authorized route
    protected $hidden = ['path'];

    protected $appends = ['label'];

    public function getLabelAttribute(): string
    {
        return self::TYPES[$this->type] ?? $this->type;
    }

    public function household()
    {
        return $this->belongsTo(Household::class);
    }
}
