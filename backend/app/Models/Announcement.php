<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * LGU announcements (barangay_id = null) go to barangay officials.
 * Barangay announcements (barangay_id set) go to that barangay's residents.
 */
class Announcement extends Model
{
    protected $fillable = [
        'user_id', 'barangay_id', 'source_announcement_id', 'distribution_event_id',
        'category', 'title', 'description', 'published_at',
    ];

    protected function casts(): array
    {
        return ['published_at' => 'datetime'];
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** For LGU announcements: which barangays it was sent to. Empty = all barangays. */
    public function targetBarangays()
    {
        return $this->belongsToMany(Barangay::class, 'announcement_barangay');
    }

    /** For barangay announcements: the posting barangay. */
    public function barangay()
    {
        return $this->belongsTo(Barangay::class);
    }

    /** Barangay announcements that relayed this LGU announcement to residents. */
    public function relays()
    {
        return $this->hasMany(self::class, 'source_announcement_id');
    }

    public function scopeFromLgu(Builder $q): Builder
    {
        return $q->whereNull('barangay_id');
    }

    /** LGU announcements addressed to one barangay (directly, or sent to all). */
    public function scopeForBarangay(Builder $q, int $barangayId): Builder
    {
        return $q->whereNull('barangay_id')->where(fn ($w) => $w
            ->whereDoesntHave('targetBarangays')
            ->orWhereHas('targetBarangays', fn ($t) => $t->where('barangays.id', $barangayId)));
    }
}
