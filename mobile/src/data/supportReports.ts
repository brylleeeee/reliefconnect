// src/data/supportReports.ts  —  reports to the barangay: staff field problems and resident complaints
import { api } from '../lib/api';

export type SupportReport = {
  id: number;
  category: string;
  message: string;
  status: 'open' | 'resolved';
  event: string | null;           // the distribution it is about
  resolution_note: string | null; // the barangay's response
  submitted_at: string;
  resolved_at: string | null;
};

// Must match SupportReport::STAFF_CATEGORIES and RESIDENT_CATEGORIES in the backend
export const STAFF_CATEGORIES = [
  'Short on goods',
  'Technical problem',
  'Resident concern',
  'Field complaint',
  'Other',
] as const;

export const RESIDENT_CATEGORIES = [
  'Incomplete or missing aid',
  'Not on the distribution list',
  'Staff conduct',
  'Other',
] as const;

type Who = 'distribution' | 'resident';

/** The logged-in user's own reports, newest first. */
export const fetchReports = (who: Who) => api<SupportReport[]>(`/${who}/support-reports`);

export const sendReport = (
  who: Who,
  body: { category: string; message: string; distribution_event_id?: number | null },
) => api<SupportReport>(`/${who}/support-reports`, { body });