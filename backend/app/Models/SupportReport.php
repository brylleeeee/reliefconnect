<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A complaint from a resident or a field problem from distribution staff, sent to their barangay. */
class SupportReport extends Model
{
    public const RESIDENT_CATEGORIES = [
        'Incomplete or missing aid',
        'Not on the distribution list',
        'Staff conduct',
        'Other',
    ];

    public const STAFF_CATEGORIES = [
        'Short on goods',
        'Technical problem',
        'Resident concern',
        'Field complaint',
        'Other',
    ];

    protected $fillable = [
        'barangay_id', 'reported_by', 'reporter_role', 'household_id', 'distribution_event_id',
        'category', 'message', 'status', 'resolution_note', 'resolved_by', 'resolved_at',
    ];

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }

    public function barangay()
    {
        return $this->belongsTo(Barangay::class);
    }

    public function reporter()
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function household()
    {
        return $this->belongsTo(Household::class);
    }

    public function event()
    {
        return $this->belongsTo(DistributionEvent::class, 'distribution_event_id');
    }

    public function resolver()
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    /** The shape the mobile apps show in "My Reports". */
    public function toMobile(): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category,
            'message' => $this->message,
            'status' => $this->status,
            'event' => $this->event?->name,
            'resolution_note' => $this->resolution_note,
            'submitted_at' => $this->created_at,
            'resolved_at' => $this->resolved_at,
        ];
    }
}