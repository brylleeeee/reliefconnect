<?php

namespace App\Services;

use App\Models\Household;
use App\Models\HouseholdMember;
use App\Models\HouseholdRepresentative;
use App\Models\User;
use App\Support\PersonName;
use Illuminate\Validation\ValidationException;

/**
 * Authorized representatives (adviser): instead of letting one person head two households, a relative or
 * caregiver is named as the household's representative. They may claim its relief, but they are not a
 * member, so they never count in its priority score. One person may represent only a few households.
 */
class RepresentativeService
{
    /** Adds or replaces the household's representative. */
    public function set(Household $household, array $data, User $by): HouseholdRepresentative
    {
        $key = PersonName::key($data['full_name']);
        $birthdate = substr((string) $data['birthdate'], 0, 10);

        // A member can already claim with the household's QR: they don't need to be a representative
        $isMember = $household->members()->where('name_key', $key)->whereDate('birthdate', $birthdate)->exists();
        if ($isMember) {
            throw ValidationException::withMessages([
                'full_name' => "{$data['full_name']} is already a member of this household, so they can claim with the household's QR code.",
            ]);
        }

        $max = (int) config('relief.representative_max_households', 2);
        $others = HouseholdRepresentative::where('name_key', $key)->whereDate('birthdate', $birthdate)
            ->where('household_id', '!=', $household->id)
            ->whereHas('household', fn ($q) => $q->where('status', '!=', 'rejected'))
            ->with('household:id,household_head,reference_number')->get();
        if ($others->count() >= $max) {
            $list = $others->map(fn ($r) => "{$r->household->household_head} ({$r->household->reference_number})")->implode(', ');
            throw ValidationException::withMessages([
                'full_name' => "{$data['full_name']} already represents {$others->count()} households ({$list}). "
                    ."One person can represent at most {$max}.",
            ]);
        }

        return HouseholdRepresentative::updateOrCreate(
            ['household_id' => $household->id],
            [
                'full_name' => trim($data['full_name']),
                'relationship' => $data['relationship'],
                'birthdate' => $birthdate,
                'contact_number' => $data['contact_number'] ?? null,
                'added_by' => $by->id,
            ],
        );
    }

    /** Where else this person is registered (as a member or representative), for the barangay's information. */
    public function alsoKnownAs(HouseholdRepresentative $rep): array
    {
        $memberOf = HouseholdMember::where('name_key', $rep->name_key)->whereDate('birthdate', $rep->birthdate)
            ->whereHas('household', fn ($q) => $q->where('status', '!=', 'rejected'))
            ->with('household:id,household_head,reference_number')->get()
            ->map(fn ($m) => ['as' => $m->relationship === 'Head' ? 'Head' : 'Member', 'head' => $m->household->household_head,
                'reference_number' => $m->household->reference_number]);
        $represents = HouseholdRepresentative::where('name_key', $rep->name_key)->whereDate('birthdate', $rep->birthdate)
            ->where('id', '!=', $rep->id)->with('household:id,household_head,reference_number')->get()
            ->map(fn ($r) => ['as' => 'Representative', 'head' => $r->household->household_head,
                'reference_number' => $r->household->reference_number]);

        return $memberOf->concat($represents)->values()->all();
    }
}
