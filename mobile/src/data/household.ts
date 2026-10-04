// src/data/household.ts  —  the resident's household: types, API calls, and conversions
import type { ImagePickerAsset } from 'expo-image-picker';
import { api, ApiError } from '../lib/api';

export type Sex = '' | 'M' | 'F';

/** One person in the household form. The head is kept separately from the other members. */
export type Member = {
  id: string;
  name: string;
  relationship: string; // Head, Spouse, Child, Parent, Sibling, Grandchild, Relative, Other
  birthdate: string;    // YYYY-MM-DD
  sex: Sex;
  isPwd: boolean;
  isPregnant: boolean;
};

export const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Grandchild', 'Relative', 'Other'];

export const newMember = (relationship = 'Child', name = ''): Member => ({
  id: `${Date.now()}-${Math.random()}`,
  name,
  relationship,
  birthdate: '',
  sex: '',
  isPwd: false,
  isPregnant: false,
});

export type QrStatus = 'pending' | 'approved' | 'rejected';
export type StepStatus = 'completed' | 'in_progress' | 'pending';

export type Step = {
  title: string;
  description?: string;
  status: StepStatus;
};

export type Household = {
  id: number;
  status: QrStatus;
  rejectionReason: string | null;
  householdName: string;
  headName: string;
  contact: string;
  barangay: string;
  barangayId: number;
  purok: string;
  address: string;
  isSoloParent: boolean;
  head: Member;
  members: Member[];              // everyone except the head
  referenceNumber: string | null; // issued by the barangay on approval
  qrToken: string | null;         // what the QR encodes: "RC:<reference no.>:<token>", new on every login
};

/** Everything collected in steps 1 and 2 before sending. */
export type HouseholdDraft = {
  barangayId: number;
  barangayName: string;
  purok: string;
  address: string;
  isSoloParent: boolean;
  head: Member;
  members: Member[];
};

// The application timeline shown on the Our QR tab
export function getSteps(status: QrStatus): Step[] {
  const approved = status === 'approved';
  return [
    {
      title: 'Information Submitted',
      description: 'Household details and members registered',
      status: 'completed',
    },
    {
      title: 'Barangay Document Verification',
      status: approved ? 'completed' : 'in_progress',
    },
    {
      title: 'QR Code Activation',
      description: 'Your digital passport for aid collection',
      status: approved ? 'completed' : 'pending',
    },
  ];
}

// ---------- validation ----------

/** A real calendar date in YYYY-MM-DD, not in the future. */
export function isValidBirthdate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const real = date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  return real && y >= 1900 && date <= new Date();
}

/** First problem found in one member's details, or null. */
export function memberProblem(m: Member, label: string): string | null {
  if (!m.name.trim()) return `Enter the full name of ${label}.`;
  if (!isValidBirthdate(m.birthdate)) return `Enter ${label}'s birthdate as YYYY-MM-DD (e.g. 1985-04-23).`;
  if (!m.sex) return `Select the sex of ${label}.`;
  if (!m.relationship) return `Select the relationship of ${label}.`;
  return null;
}

// ---------- API ----------

type ApiMember = {
  full_name: string; relationship: string; birthdate: string; sex: 'M' | 'F';
  is_pwd: boolean; is_pregnant: boolean;
};

type ApiHousehold = {
  id: number;
  status: QrStatus;
  rejection_reason: string | null;
  reference_number: string | null;
  qr_value: string | null;
  household_head: string;
  contact_number: string | null;
  barangay: { id: number; name: string };
  purok: string | null;
  address: string | null;
  is_solo_parent: boolean;
  members: ApiMember[];
};

const fromApiMember = (m: ApiMember, i: number): Member => ({
  id: `m${i}`,
  name: m.full_name,
  relationship: m.relationship,
  birthdate: m.birthdate,
  sex: m.sex,
  isPwd: !!m.is_pwd,
  isPregnant: !!m.is_pregnant,
});

const toApiMember = (m: Member): ApiMember => ({
  full_name: m.name.trim(),
  relationship: m.relationship,
  birthdate: m.birthdate,
  sex: m.sex as 'M' | 'F',
  is_pwd: m.isPwd,
  is_pregnant: m.sex === 'F' && m.isPregnant,
});

function toHousehold(h: ApiHousehold): Household {
  const members = h.members.map(fromApiMember);
  const head = members.find((m) => m.relationship === 'Head') ?? newMember('Head', h.household_head);
  return {
    id: h.id,
    status: h.status,
    rejectionReason: h.rejection_reason,
    householdName: `${h.household_head.split(' ').slice(-1)[0]} Household`,
    headName: h.household_head,
    contact: h.contact_number ?? '',
    barangay: h.barangay.name,
    barangayId: h.barangay.id,
    purok: h.purok ?? '',
    address: h.address ?? '',
    isSoloParent: h.is_solo_parent,
    head,
    members: members.filter((m) => m !== head),
    referenceNumber: h.reference_number,
    qrToken: h.qr_value,
  };
}

/** The resident's own household, or null if they haven't submitted one yet. */
export async function fetchMyHousehold(): Promise<Household | null> {
  try {
    return toHousehold(await api<ApiHousehold>('/resident/household'));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** A picked photo as a data URI. The picker is asked for base64 (see household-step2). */
function photoData(asset: ImagePickerAsset, label: string): string {
  const mime = asset.mimeType ?? 'image/jpeg';
  if (asset.base64) return `data:${mime};base64,${asset.base64}`;
  if (asset.uri.startsWith('data:')) return asset.uri; // Expo web
  throw new ApiError(0, `The ${label} photo could not be read. Please choose it again.`);
}

/**
 * Sends the household and both document photos. Goes to the barangay's QR Issuance Review.
 * Photos travel as base64 inside a normal JSON request: multipart file uploads from
 * React Native are unreliable on some Android phones, while JSON requests always work.
 */
export async function submitHousehold(
  draft: HouseholdDraft,
  docs: { validId: ImagePickerAsset; birthCert: ImagePickerAsset },
): Promise<Household> {
  const body = {
    barangay_id: draft.barangayId,
    purok: draft.purok.trim(),
    address: draft.address.trim(),
    is_solo_parent: draft.isSoloParent,
    members: [toApiMember({ ...draft.head, relationship: 'Head' }), ...draft.members.map(toApiMember)],
    valid_id_base64: photoData(docs.validId, 'valid ID'),
    birth_certificate_base64: photoData(docs.birthCert, 'birth certificate'),
  };

  // Two photos can be a few MB, so allow up to 2 minutes instead of the usual 20 seconds
  return toHousehold(await api<ApiHousehold>('/resident/household', { method: 'POST', body, timeoutMs: 120000 }));
}

/** Pre-fills the form when a rejected household is corrected and resubmitted. */
export function draftFrom(h: Household): HouseholdDraft {
  return {
    barangayId: h.barangayId,
    barangayName: h.barangay,
    purok: h.purok,
    address: h.address,
    isSoloParent: h.isSoloParent,
    head: h.head,
    members: h.members,
  };
}

export type Barangay = { id: number; name: string };
export const fetchBarangays = () => api<Barangay[]>('/barangays');
