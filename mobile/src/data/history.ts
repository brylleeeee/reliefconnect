// src/data/history.ts — the resident's past claims, from the server (GET /resident/claims).
// These are the same release records staff and admins see, so History updates right after
// staff release aid (or when an offline release syncs).
import { api, qtyUnit } from '../lib/api';

export type ClaimItem = { name: string; quantity: number; unit: string };

export type ClaimRecord = {
  id: string;
  eventName: string;
  category: 'Cash' | 'Relief goods';
  claimedAt: string; // ISO date-time
  venue: string | null;
  items: ClaimItem[];
  cashAmount?: number; // pesos, for cash assistance
  method: 'qr' | 'reference_number';
};

type ApiClaim = {
  id: number;
  event: string;
  is_cash: boolean;
  item: string;
  contents: string | null; // e.g. "Rice, Canned Goods, Coffee"
  quantity: number;
  unit: string;
  venue: string | null;
  claimed_at: string;
  method: 'qr' | 'reference_number';
};

export async function fetchHistory(): Promise<ClaimRecord[]> {
  const list = await api<ApiClaim[]>('/resident/claims');

  return list.map((c) => ({
    id: String(c.id),
    eventName: c.event,
    category: c.is_cash ? 'Cash' : 'Relief goods',
    claimedAt: c.claimed_at,
    venue: c.venue,
    items: c.is_cash
      ? []
      : [{ name: c.contents ? `${c.item} (${c.contents})` : c.item, quantity: c.quantity, unit: c.unit }],
    cashAmount: c.is_cash ? c.quantity : undefined,
    method: c.method,
  }));
}

/** "1 Pack", "2 Packs" (units are stored in plural form). */
export const itemQty = (it: ClaimItem) => qtyUnit(it.quantity, it.unit);
