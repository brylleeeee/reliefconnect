// src/data/household.ts
import type { Member } from '../components/MemberCard';

export type QrStatus = 'pending' | 'approved';
export type StepStatus = 'completed' | 'in_progress' | 'pending';

export type Step = {
  title: string;
  description?: string;
  status: StepStatus;
};

export type Household = {
  status: QrStatus;
  householdName: string;
  headName: string;
  contact: string;
  barangay: string;
  members: Member[];
  referenceNumber: string | null; // issued by the admin on approval
  qrToken: string | null;         // issued by the admin on approval
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
      title: 'LGU Document Verification',
      status: approved ? 'completed' : 'in_progress',
    },
    {
      title: 'QR Code Activation',
      description: 'Your digital passport for aid collection',
      status: approved ? 'completed' : 'pending',
    },
  ];
}

// Used by the login screen until the API is connected
export const sampleHousehold: Household = {
  status: 'pending',
  householdName: 'Dela Cruz Household',
  headName: 'Juan Dela Cruz',
  contact: '09171234567',
  barangay: 'Batancaoa',
  members: [],
  referenceNumber: null,
  qrToken: null,
};