<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DistributionEvent extends Model
{
    protected $fillable = [
        'name', 'relief_item_id', 'quantity_per_household', 'eligibility', 'distribute_by',
        'notes', 'status', 'closed_at', 'created_by',
    ];

    /**
     * Who can receive. "member" rules give the amount to each qualifying member
     * (2 seniors = 2 kits); "household" rules give it once per household.
     */
    public const ELIGIBILITY = [
        'all' => ['label' => 'All households', 'per' => 'household', 'recipient' => 'household'],
        'senior' => ['label' => 'Households with a senior citizen (60+)', 'per' => 'member',
            'column' => 'seniors_count', 'recipient' => 'senior citizen'],
        'pwd' => ['label' => 'Households with a person with disability', 'per' => 'member',
            'column' => 'pwd_count', 'recipient' => 'person with disability'],
        'infant' => ['label' => 'Households with an infant (0-1 yr)', 'per' => 'member',
            'column' => 'infants_count', 'recipient' => 'infant'],
        'pregnant' => ['label' => 'Households with a pregnant member', 'per' => 'member',
            'column' => 'pregnant_count', 'recipient' => 'pregnant member'],
        'solo_parent' => ['label' => 'Solo-parent households', 'per' => 'household', 'recipient' => 'household'],
    ];

    // Match the database defaults so a freshly created event knows its status
    protected $attributes = ['status' => 'open', 'quantity_per_household' => 1, 'eligibility' => 'all'];

    protected $appends = ['eligibility_label', 'per_member', 'recipient_label'];

    public function getEligibilityLabelAttribute(): string
    {
        return self::ELIGIBILITY[$this->eligibility]['label'] ?? 'All households';
    }

    public function getPerMemberAttribute(): bool
    {
        return (self::ELIGIBILITY[$this->eligibility]['per'] ?? 'household') === 'member';
    }

    public function getRecipientLabelAttribute(): string
    {
        return self::ELIGIBILITY[$this->eligibility]['recipient'] ?? 'household';
    }

    /** Limits a households query to those that can receive under a rule. */
    public static function applyEligibility($query, string $rule)
    {
        $r = self::ELIGIBILITY[$rule] ?? self::ELIGIBILITY['all'];

        return match (true) {
            isset($r['column']) => $query->where($r['column'], '>', 0),
            $rule === 'solo_parent' => $query->where('is_solo_parent', true),
            default => $query,
        };
    }

    /** How many recipients a household counts as: its qualifying members, or 1. */
    public static function recipientsIn(string $rule, Household $household): int
    {
        $r = self::ELIGIBILITY[$rule] ?? self::ELIGIBILITY['all'];

        return match (true) {
            isset($r['column']) => (int) $household->{$r['column']},
            $rule === 'solo_parent' => $household->is_solo_parent ? 1 : 0,
            default => 1,
        };
    }

    /** What this household receives in this event (0 = not eligible). */
    public function quantityFor(Household $household): int
    {
        return self::recipientsIn($this->eligibility, $household) * $this->quantity_per_household;
    }

    /**
     * Units needed for $households more households of a barangay. Per-household rules are
     * exact; per-member rules use the households with the most qualifying members, so the
     * stock set aside is always enough whoever comes to claim.
     */
    public static function unitsNeeded(string $rule, int $qty, int $barangayId, int $households, array $excludeHouseholdIds = []): int
    {
        if ($households <= 0) {
            return 0;
        }
        $r = self::ELIGIBILITY[$rule] ?? self::ELIGIBILITY['all'];
        if (! isset($r['column'])) {
            return $households * $qty;
        }

        $members = self::applyEligibility(Household::query(), $rule)
            ->where('barangay_id', $barangayId)->where('status', 'approved')
            ->when($excludeHouseholdIds, fn ($q) => $q->whereNotIn('id', $excludeHouseholdIds))
            ->orderByDesc($r['column'])->limit($households)
            ->pluck($r['column'])->sum();

        return (int) $members * $qty;
    }

    protected function casts(): array
    {
        return [
            'distribute_by' => 'date:Y-m-d',
            'closed_at' => 'datetime',
        ];
    }

    public function item()
    {
        return $this->belongsTo(ReliefItem::class, 'relief_item_id');
    }

    public function barangayDistributions()
    {
        return $this->hasMany(BarangayDistribution::class);
    }

    public function distributions()
    {
        return $this->hasMany(Distribution::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Open events first, newest first. */
    public function scopeBoardOrder($query)
    {
        return $query->orderByRaw("FIELD(status, 'open', 'closed')")->latest();
    }

    public function forBarangay(int $barangayId): ?BarangayDistribution
    {
        return $this->barangayDistributions()->where('barangay_id', $barangayId)->first();
    }

    /**
     * Units of an item promised to barangays that haven't closed their distribution yet,
     * minus what they already claimed. Stops two events from counting on the same stock.
     */
    public static function reservedUnits(int $reliefItemId, ?int $exceptEventId = null): int
    {
        return (int) BarangayDistribution::query()
            ->with('event')
            ->whereIn('status', ['unscheduled', 'scheduled', 'ongoing'])
            ->whereHas('event', fn ($q) => $q
                ->where('relief_item_id', $reliefItemId)
                ->where('status', 'open')
                ->when($exceptEventId, fn ($q) => $q->where('id', '!=', $exceptEventId)))
            ->get()
            ->sum(fn (BarangayDistribution $bd) => $bd->remainingUnits());
    }
}
