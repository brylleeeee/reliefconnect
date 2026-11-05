<?php

namespace App\Services;

use App\Models\Household;
use App\Models\HouseholdUpdateRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Household update requests: an approved household proposes new details, the barangay reviews them.
 * On approval the proposed details go through HouseholdService::save(), so they get the same
 * duplicate check and priority scoring as a registration. Reference number and QR don't change.
 */
class HouseholdUpdateService
{
    /** Member fields compared when showing what changed. */
    private const MEMBER_FIELDS = [
        'full_name' => 'Name', 'relationship' => 'Relationship', 'birthdate' => 'Birthdate',
        'sex' => 'Sex', 'is_pwd' => 'PWD', 'is_pregnant' => 'Pregnant',
    ];

    public function __construct(private HouseholdService $households) {}

    /** $changes = purok, address, is_solo_parent, members[] (the full new list, head first). */
    public function submit(Household $household, User $resident, array $changes, ?string $reason): HouseholdUpdateRequest
    {
        if ($household->status !== 'approved') {
            throw ValidationException::withMessages([
                'household' => 'Only approved households can request changes. Wait for your barangay to review your registration.',
            ]);
        }
        if ($household->updateRequests()->where('status', 'pending')->exists()) {
            throw ValidationException::withMessages([
                'household' => 'You already have a request waiting for your barangay. Cancel it first if you need to change it.',
            ]);
        }

        $changes = $this->normalize($changes);
        if (! $this->hasChanges($household, $changes)) {
            throw ValidationException::withMessages(['household' => 'Nothing was changed. Edit your details before sending the request.']);
        }

        // Catch duplicates now, so the resident can fix them before the barangay sees the request
        $this->households->assertNoDuplicates($changes['members'], $household->id);

        return $household->updateRequests()->create([
            'requested_by' => $resident->id,
            'status' => 'pending',
            'changes' => $changes,
            'reason' => $reason ? trim($reason) : null,
        ]);
    }

    public function cancel(HouseholdUpdateRequest $request): HouseholdUpdateRequest
    {
        $this->ensurePending($request);
        $request->update(['status' => 'cancelled']);

        return $request;
    }

    /** Applies the proposed details to the household. All or nothing. */
    public function approve(HouseholdUpdateRequest $request, User $reviewer): HouseholdUpdateRequest
    {
        $this->ensurePending($request);

        DB::transaction(function () use ($request, $reviewer) {
            $household = $request->household;
            $this->households->save($household, $request->changes + [
                'contact_number' => $household->contact_number, // the mobile number belongs to the login account
            ]);

            $request->update(['status' => 'approved', 'reviewed_by' => $reviewer->id, 'reviewed_at' => now()]);
        });

        app(ResidentNotifier::class)->updateReviewed($request);

        return $request;
    }

    public function reject(HouseholdUpdateRequest $request, User $reviewer, string $note): HouseholdUpdateRequest
    {
        $this->ensurePending($request);
        $request->update([
            'status' => 'rejected', 'review_note' => trim($note),
            'reviewed_by' => $reviewer->id, 'reviewed_at' => now(),
        ]);

        app(ResidentNotifier::class)->updateReviewed($request);

        return $request;
    }

    /**
     * What the request changes compared with the household as it is now:
     * field changes, and members added, removed or edited.
     */
    public function diff(HouseholdUpdateRequest $request): array
    {
        $household = $request->household->loadMissing('members');
        $new = $request->changes;

        $fields = [];
        foreach (['purok' => 'Purok', 'address' => 'Street / Sitio', 'is_solo_parent' => 'Solo parent'] as $key => $label) {
            $before = $key === 'is_solo_parent' ? (bool) $household->$key : (string) ($household->$key ?? '');
            $after = $key === 'is_solo_parent' ? (bool) ($new[$key] ?? false) : (string) ($new[$key] ?? '');
            if ($before !== $after) {
                $fields[] = ['field' => $label, 'before' => $this->show($before), 'after' => $this->show($after)];
            }
        }

        $current = $household->members->map(fn ($m) => $this->memberRow([
            'full_name' => $m->full_name, 'relationship' => $m->relationship, 'birthdate' => $m->birthdate?->toDateString(),
            'sex' => $m->sex, 'is_pwd' => $m->is_pwd, 'is_pregnant' => $m->is_pregnant,
        ]))->values()->all();
        $proposed = array_map(fn ($m) => $this->memberRow($m), $new['members']);

        [$pairs, $added, $removed] = $this->match($current, $proposed);

        $edited = [];
        foreach ($pairs as [$before, $after]) {
            $what = [];
            foreach (self::MEMBER_FIELDS as $key => $label) {
                if ($before[$key] !== $after[$key]) {
                    $what[] = ['field' => $label, 'before' => $this->show($before[$key], $key), 'after' => $this->show($after[$key], $key)];
                }
            }
            if ($what) {
                $edited[] = ['name' => $after['full_name'], 'changes' => $what];
            }
        }

        return [
            'fields' => $fields,
            'members_added' => array_values($added),
            'members_removed' => array_values($removed),
            'members_edited' => $edited,
            'count' => count($fields) + count($added) + count($removed) + count($edited),
        ];
    }

    // ---------------------------------------------------------------

    private function hasChanges(Household $household, array $changes): bool
    {
        $probe = new HouseholdUpdateRequest(['changes' => $changes]);
        $probe->setRelation('household', $household);

        return $this->diff($probe)['count'] > 0;
    }

    /** Same shape and clean-up as a registration, so comparing and applying are exact. */
    private function normalize(array $c): array
    {
        return [
            'purok' => trim((string) ($c['purok'] ?? '')),
            'address' => trim((string) ($c['address'] ?? '')) ?: null,
            'is_solo_parent' => (bool) ($c['is_solo_parent'] ?? false),
            'members' => array_values(array_map(fn ($m) => [
                'full_name' => trim($m['full_name']),
                'relationship' => $m['relationship'],
                'birthdate' => substr((string) $m['birthdate'], 0, 10),
                'sex' => $m['sex'],
                'is_pwd' => (bool) ($m['is_pwd'] ?? false),
                'is_pregnant' => $m['sex'] === 'F' && ($m['is_pregnant'] ?? false),
            ], $c['members'])),
        ];
    }

    private function memberRow(array $m): array
    {
        return [
            'full_name' => trim((string) $m['full_name']),
            'relationship' => (string) $m['relationship'],
            'birthdate' => substr((string) $m['birthdate'], 0, 10),
            'sex' => (string) $m['sex'],
            'is_pwd' => (bool) ($m['is_pwd'] ?? false),
            'is_pregnant' => (bool) ($m['is_pregnant'] ?? false),
        ];
    }

    /**
     * Pairs current and proposed members: first by name, then (for a corrected name) by birthdate.
     * Whoever is left over was added or removed.
     *
     * @return array{0: array<int, array{0: array, 1: array}>, 1: array, 2: array}
     */
    private function match(array $current, array $proposed): array
    {
        $pairs = [];
        foreach ([fn ($m) => mb_strtolower($m['full_name']), fn ($m) => $m['birthdate']] as $key) {
            foreach ($current as $ci => $c) {
                foreach ($proposed as $pi => $p) {
                    if ($key($c) === $key($p)) {
                        $pairs[] = [$c, $p];
                        unset($current[$ci], $proposed[$pi]);
                        continue 2;
                    }
                }
            }
        }

        return [$pairs, $proposed, $current];
    }

    private function show(mixed $v, ?string $field = null): string
    {
        return match (true) {
            is_bool($v) => $v ? 'Yes' : 'No',
            $v === '' || $v === null => '—',
            $field === 'sex' => $v === 'F' ? 'Female' : 'Male',
            default => (string) $v,
        };
    }

    private function ensurePending(HouseholdUpdateRequest $request): void
    {
        if ($request->status !== 'pending') {
            throw ValidationException::withMessages(['status' => 'This request has already been '.$request->status.'.']);
        }
    }
}
