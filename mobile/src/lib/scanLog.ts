// src/lib/scanLog.ts — every scan result by this staff member, saved on the phone.
// TODO: also send to the backend (activity log) so admins can see it.
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ScanResult = 'released' | 'blocked' | 'error';

export type ScanEntry = {
  id: string;
  at: string; // ISO date-time
  staffId: number;
  eventId: number;
  eventName: string;
  barangay: string;
  item: string;
  unit: string;
  quantity: number;
  reference: string;
  head: string | null;
  result: ScanResult;
  reason: string | null;
  method: 'qr' | 'reference_number';
  photoUri?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null; // meters
  ip?: string | null;
};

const KEY = 'staff_scan_log';
const MAX = 300; // keep the newest 300 entries

export async function getScans(): Promise<ScanEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addScan(entry: Omit<ScanEntry, 'id' | 'at'>) {
  const list = await getScans();
  list.unshift({
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
  });
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}