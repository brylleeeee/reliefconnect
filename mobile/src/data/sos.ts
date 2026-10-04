// src/data/sos.ts  —  SOS: pressing it means "my household needs relief goods"
import { api } from '../lib/api';

export type Sos = {
  id: number;
  people_count: number;
  message: string | null;
  created_at: string;
};

/** The resident's active SOS, or null. */
export const fetchActiveSos = async (): Promise<Sos | null> =>
  (await api<{ sos: Sos | null }>('/resident/sos')).sos;

/**
 * The barangay and household size come from the registered household. The optional message
 * ("baha na kami") is scored by the LGU's system and helps it decide who to serve first.
 * Sending again while an SOS is active adds the message to it.
 */
export const sendSos = async (message?: string): Promise<Sos> =>
  (await api<{ sos: Sos }>('/resident/sos', { method: 'POST', body: { message: message?.trim() || undefined } })).sos;

export const cancelSos = async (): Promise<void> => {
  await api('/resident/sos/cancel', { method: 'POST' });
};
