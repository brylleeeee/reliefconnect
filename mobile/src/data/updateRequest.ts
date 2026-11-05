// src/data/updateRequest.ts  —  asking the barangay to update an approved household's details
import { api, ApiError } from '../lib/api';
import type { HouseholdDraft, Member } from './household';

export type UpdateStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

type Change = { field: string; before: string; after: string };
type ApiMember = { full_name: string; relationship: string; birthdate: string; sex: 'M' | 'F' };

/** What a waiting request changes, worked out by the server (same view the barangay gets). */
export type UpdateSummary = {
  fields: Change[];
  members_added: ApiMember[];
  members_removed: ApiMember[];
  members_edited: { name: string; changes: Change[] }[];
  count: number;
};

export type UpdateRequest = {
  id: number;
  status: UpdateStatus;
  reason: string | null;
  review_note: string | null; // the barangay's reason when rejected
  submitted_at: string;
  reviewed_at: string | null;
  summary: UpdateSummary | null; // only while pending
};

/** The latest request (any status), or null if the resident never sent one. */
export const fetchUpdateRequest = () => api<UpdateRequest | null>('/resident/household/update-request');

const toApiMember = (m: Member) => ({
  full_name: m.name.trim(),
  relationship: m.relationship,
  birthdate: m.birthdate,
  sex: m.sex as 'M' | 'F',
  is_pwd: m.isPwd,
  is_pregnant: m.sex === 'F' && m.isPregnant,
});

/** Sends the full new set of details; the barangay sees only what changed. */
export function submitUpdateRequest(draft: HouseholdDraft, reason: string) {
  return api<UpdateRequest>('/resident/household/update-request', {
    method: 'POST',
    body: {
      purok: draft.purok.trim(),
      address: draft.address.trim(),
      is_solo_parent: draft.isSoloParent,
      members: [toApiMember({ ...draft.head, relationship: 'Head' }), ...draft.members.map(toApiMember)],
      reason: reason.trim(),
    },
  });
}

export async function cancelUpdateRequest(): Promise<UpdateRequest | null> {
  try {
    return await api<UpdateRequest>('/resident/household/update-request', { method: 'DELETE' });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null; // already reviewed or cancelled
    throw e;
  }
}

/** One line per change, for the "waiting for review" card. */
export function describeChanges(s: UpdateSummary): string[] {
  return [
    ...s.fields.map((c) => `${c.field}: ${c.before} → ${c.after}`),
    ...s.members_added.map((m) => `Add ${m.full_name} (${m.relationship})`),
    ...s.members_removed.map((m) => `Remove ${m.full_name}`),
    ...s.members_edited.map((m) => `Correct ${m.name}: ${m.changes.map((c) => c.field.toLowerCase()).join(', ')}`),
  ];
}
