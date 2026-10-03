// src/data/history.ts — the resident's past claims.
// TODO: replace the sample with the real endpoint once the backend has it,
// e.g. `const { data } = await api.get('/resident/claims'); return data;`

export type ClaimItem = { name: string; quantity: number; unit: string };

export type ClaimRecord = {
  id: string;
  eventName: string;
  category: 'Food' | 'Hygiene' | 'Water' | 'Cash';
  claimedAt: string; // ISO date-time
  venue: string;
  items: ClaimItem[];
  cashAmount?: number; // pesos, for cash assistance
  receivedBy: string;
  method: 'qr' | 'reference_number';
};

const SAMPLE: ClaimRecord[] = [
  {
    id: '3',
    eventName: 'Typhoon Relief: Family Food Packs',
    category: 'Food',
    claimedAt: '2026-09-22T09:42:00',
    venue: 'Barangay Batancaoa Hall',
    items: [
      { name: 'Rice', quantity: 5, unit: 'kilo' },
      { name: 'Canned goods', quantity: 6, unit: 'pieces' },
      { name: 'Instant coffee', quantity: 1, unit: 'pack' },
    ],
    receivedBy: 'Juan Dela Cruz',
    method: 'qr',
  },
  {
    id: '2',
    eventName: 'Emergency Cash Assistance',
    category: 'Cash',
    claimedAt: '2026-08-15T10:05:00',
    venue: 'Municipal Hall, Urbiztondo',
    items: [],
    cashAmount: 3000,
    receivedBy: 'Maria Dela Cruz',
    method: 'reference_number',
  },
  {
    id: '1',
    eventName: 'Barangay Sanitary Care Kit',
    category: 'Hygiene',
    claimedAt: '2026-06-03T14:10:00',
    venue: 'Batancaoa Covered Court',
    items: [
      { name: 'Bath soap', quantity: 2, unit: 'pieces' },
      { name: 'Toothbrush', quantity: 4, unit: 'pieces' },
      { name: 'Alcohol / sanitizer', quantity: 1, unit: 'bottle' },
    ],
    receivedBy: 'Juan Dela Cruz',
    method: 'qr',
  },
];

export async function fetchHistory(): Promise<ClaimRecord[]> {
  return SAMPLE;
}