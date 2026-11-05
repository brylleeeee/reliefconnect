<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A resident's request to change their approved household's details. See HouseholdUpdateService. */
class HouseholdUpdateRequest extends Model
{
    protected $fillable = ['household_id', 'requested_by', 'status', 'changes', 'reason', 'review_note', 'reviewed_by', 'reviewed_at'];

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'reviewed_at' => 'datetime',
        ];
    }

    public function household()
    {
        return $this->belongsTo(Household::class);
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
