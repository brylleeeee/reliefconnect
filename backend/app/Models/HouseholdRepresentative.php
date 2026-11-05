<?php

namespace App\Models;

use App\Support\PersonName;
use Illuminate\Database\Eloquent\Model;

/** Someone allowed to claim relief for a household (an authorization letter). Not a member. */
class HouseholdRepresentative extends Model
{
    public const RELATIONSHIPS = ['Son', 'Daughter', 'Grandchild', 'Sibling', 'Niece/Nephew', 'Relative', 'Neighbor', 'Caregiver', 'Other'];

    protected $fillable = ['household_id', 'full_name', 'relationship', 'birthdate', 'contact_number', 'added_by'];

    protected $hidden = ['name_key'];

    protected function casts(): array
    {
        return ['birthdate' => 'date:Y-m-d'];
    }

    protected static function booted(): void
    {
        static::saving(fn (self $r) => $r->name_key = PersonName::key((string) $r->full_name));
    }

    public function household()
    {
        return $this->belongsTo(Household::class);
    }

    /** "Juan Cruz (Son)" */
    public function label(): string
    {
        return "{$this->full_name} ({$this->relationship})";
    }
}
