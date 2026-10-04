// src/data/sos.ts  —  SOS: pressing it means "my household needs relief goods"
import { api } from '../lib/api';

export type Sos = {
  id: number;
  people_count: number;
  created_at: string;
};

/** The resident's active SOS, or null. */
export const fetchActiveSos = async (): Promise<Sos | null> =>
  (await api<{ sos: Sos | null }>('/resident/sos')).sos;

/** The barangay and household size come from the registered household, so nothing is sent. */
export const sendSos = async (): Promise<Sos> =>
  (await api<{ sos: Sos }>('/resident/sos', { method: 'POST' })).sos;

export const cancelSos = async (): Promise<void> => {
  await api('/resident/sos/cancel', { method: 'POST' });
};
