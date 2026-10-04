<?php

namespace App\Services;

use App\Models\Household;
use App\Models\HouseholdMember;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class HouseholdService
{
    public function __construct(private PriorityScorer $scorer) {}

    /**
     * Create or update a household and replace its member list.
     * $data = household fields + 'members' => [...] (first member is the head).
     */
    public function save(Household $household, array $data, bool $checkDuplicates = true): Household
    {
        if ($checkDuplicates) {
            $this->assertNoDuplicates($data['members'], $household->exists ? $household->id : null);
        }

        return DB::transaction(function () use ($household, $data) {
            $members = $data['members'];

            $household->fill([
                'household_head' => trim($members[0]['full_name']),
                'purok' => $data['purok'] ?? null,
                'address' => $data['address'] ?? null,
                'contact_number' => $data['contact_number'] ?? null,
                'is_solo_parent' => (bool) ($data['is_solo_parent'] ?? false),
            ]);
            $household->save();

            $household->members()->delete();
            $household->members()->createMany(array_map(fn ($m) => [
                'full_name' => trim($m['full_name']),
                'relationship' => $m['relationship'],
                'birthdate' => $m['birthdate'],
                'sex' => $m['sex'],
                'is_pwd' => (bool) ($m['is_pwd'] ?? false),
                'is_pregnant' => $m['sex'] === 'F' && ($m['is_pregnant'] ?? false),
            ], $members));

            $household->load('members');
            $this->scorer->apply($household);
            $household->save();

            return $household;
        });
    }

    /** Approve a household: issue its reference number and QR secret. */
    public function approve(Household $household, User $reviewer): Household
    {
        $household->forceFill([
            'status' => 'approved',
            'approved_at' => now(),
            'reviewed_by' => $reviewer->id,
            'rejection_reason' => null,
            'reference_number' => $household->reference_number
                ?? sprintf('URB-%s-%06d', now()->year, $household->id),
            'qr_secret' => $household->qr_secret ?? Str::random(40),
        ])->save();

        // TODO: send the reference number to $household->contact_number via the SMS gateway
        app(ResidentNotifier::class)->reviewed($household); // bell in the resident app (walk-ins have no account yet)

        return $household;
    }

    public function reject(Household $household, User $reviewer, string $reason): Household
    {
        $household->forceFill([
            'status' => 'rejected',
            'rejection_reason' => $reason,
            'reviewed_by' => $reviewer->id,
        ])->save();

        app(ResidentNotifier::class)->reviewed($household);

        return $household;
    }

    /**
     * Blocks masterlist duplicates: the same person (name + birthdate) cannot be in two
     * active households anywhere in the municipality.
     */
    public function assertNoDuplicates(array $members, ?int $ignoreHouseholdId = null): void
    {
        foreach ($members as $i => $m) {
            $dup = HouseholdMember::query()
                ->whereRaw('LOWER(full_name) = ?', [mb_strtolower(trim($m['full_name']))])
                ->whereDate('birthdate', $m['birthdate'])
                ->whereHas('household', fn ($q) => $q
                    ->where('status', '!=', 'rejected')
                    ->when($ignoreHouseholdId, fn ($q) => $q->where('id', '!=', $ignoreHouseholdId)))
                ->with('household.barangay')
                ->first();

            if ($dup) {
                $h = $dup->household;
                $where = "Barangay {$h->barangay->name}"
                    .($h->reference_number ? " ({$h->reference_number})" : ' (pending review)');

                throw ValidationException::withMessages([
                    "members.$i.full_name" => "{$m['full_name']} is already registered in {$where}.",
                ]);
            }
        }
    }
}
