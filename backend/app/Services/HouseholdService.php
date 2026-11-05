<?php

namespace App\Services;

use App\Models\Household;
use App\Models\HouseholdMember;
use App\Models\User;
use App\Support\PersonName;
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
        $transfers = $checkDuplicates ? $this->checkDuplicates($data['members'], $household->exists ? $household->id : null) : [];

        return DB::transaction(function () use ($household, $data, $transfers) {
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
            foreach (array_values($members) as $i => $m) {
                $household->members()->create([
                    'full_name' => trim($m['full_name']),
                    'relationship' => $m['relationship'],
                    'birthdate' => $m['birthdate'],
                    'sex' => $m['sex'],
                    'is_pwd' => (bool) ($m['is_pwd'] ?? false),
                    'is_pregnant' => $m['sex'] === 'F' && ($m['is_pregnant'] ?? false),
                    // Still listed in another household: moved out of it when this household is approved
                    'transfer_from_household_id' => isset($transfers[$i]) ? $transfers[$i]->id : null,
                ]);
            }

            // Already approved (the barangay is editing it, or approved an update request): move them now
            if ($household->status === 'approved') {
                $this->applyTransfers($household);
            }

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

        $this->applyTransfers($household); // members still listed elsewhere are moved here now

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
     * Masterlist duplicate rules (adviser). A person is matched by normalized name + birthdate
     * ("Ma. Dela Cruz" = "Maria De La Cruz"), across every non-rejected household in Urbiztondo:
     *  - listed twice in the same household            -> blocked
     *  - already the HEAD of another household         -> blocked (one person heads one household; for seniors
     *                                                      cared for by a relative, use an authorized representative)
     *  - already a MEMBER (not head) of another household -> allowed as a transfer: when the barangay approves,
     *                                                      the person is removed from the other household
     *
     * @return array<int, Household> member index => the household they will be moved out of
     */
    public function checkDuplicates(array $members, ?int $ignoreHouseholdId = null): array
    {
        $transfers = [];
        $seen = [];

        foreach ($members as $i => $m) {
            $key = PersonName::key($m['full_name']);
            $birthdate = substr((string) $m['birthdate'], 0, 10);

            if (isset($seen[$key.'|'.$birthdate])) {
                throw ValidationException::withMessages([
                    "members.$i.full_name" => "{$m['full_name']} is listed twice in this household.",
                ]);
            }
            $seen[$key.'|'.$birthdate] = true;

            $matches = HouseholdMember::query()
                ->where('name_key', $key)
                ->whereDate('birthdate', $birthdate)
                ->whereHas('household', fn ($q) => $q
                    ->where('status', '!=', 'rejected')
                    ->when($ignoreHouseholdId, fn ($q) => $q->where('id', '!=', $ignoreHouseholdId)))
                ->with('household.barangay')
                ->get();

            if ($head = $matches->firstWhere('relationship', 'Head')) {
                $where = $this->where($head->household);
                throw ValidationException::withMessages([
                    "members.$i.full_name" => $i === 0
                        ? "{$m['full_name']} already heads a household in {$where}. One person can head only one household."
                        : "{$m['full_name']} is the head of another household in {$where}, so they can't be added here. "
                          .'If you take care of them, ask the barangay to add you as their authorized representative instead.',
                ]);
            }

            if ($other = $matches->first()) {
                $transfers[$i] = $other->household;
            }
        }

        return $transfers;
    }

    /** Kept for callers that only need the blocking rules; transfers are allowed. */
    public function assertNoDuplicates(array $members, ?int $ignoreHouseholdId = null): void
    {
        $this->checkDuplicates($members, $ignoreHouseholdId);
    }

    /**
     * Moves approved members out of the households they were still listed in, recomputes those households'
     * priority, and tells them. Runs when the barangay approves (or edits) the household.
     *
     * @return int members moved
     */
    public function applyTransfers(Household $household): int
    {
        $moving = $household->members()->whereNotNull('transfer_from_household_id')->get();

        foreach ($moving as $member) {
            DB::transaction(function () use ($household, $member) {
                $old = HouseholdMember::query()
                    ->where('name_key', $member->name_key)
                    ->whereDate('birthdate', $member->birthdate)
                    ->where('household_id', '!=', $household->id)
                    ->where('relationship', '!=', 'Head')
                    ->with('household')
                    ->get();

                foreach ($old as $o) {
                    $from = $o->household;
                    $o->delete();
                    $from->load('members');
                    $this->scorer->apply($from);
                    $from->save();
                    app(ResidentNotifier::class)->memberMoved($from, $member->full_name);
                }

                $member->forceFill(['transfer_from_household_id' => null])->save();
            });
        }

        return $moving->count();
    }

    /**
     * Possible duplicates for the barangay to check: same birthdate and a similar name in another household
     * ("Jon Cruz" / "John Cruz", a missing middle initial). A warning only; nothing is blocked.
     *
     * @return array<int, array{member: string, other_name: string, household: array}>
     */
    public function possibleMatches(Household $household): array
    {
        $household->loadMissing('members');
        $found = [];

        foreach ($household->members as $member) {
            $candidates = HouseholdMember::query()
                ->whereDate('birthdate', $member->birthdate)
                ->where('household_id', '!=', $household->id)
                ->where('name_key', '!=', $member->name_key) // exact matches are handled as transfers or blocks
                ->whereHas('household', fn ($q) => $q->where('status', '!=', 'rejected'))
                ->with('household.barangay')
                ->limit(50)->get();

            foreach ($candidates as $c) {
                if (PersonName::similar($member->name_key, $c->name_key)) {
                    $found[] = [
                        'member' => $member->full_name,
                        'other_name' => $c->full_name,
                        'other_relationship' => $c->relationship,
                        'household' => [
                            'id' => $c->household->id,
                            'head' => $c->household->household_head,
                            'reference_number' => $c->household->reference_number,
                            'status' => $c->household->status,
                            'barangay' => $c->household->barangay?->name,
                        ],
                    ];
                }
            }
        }

        return $found;
    }

    private function where(Household $h): string
    {
        return "Barangay {$h->barangay->name}".($h->reference_number ? " ({$h->reference_number})" : ' (pending review)');
    }
}
