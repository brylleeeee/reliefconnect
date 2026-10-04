// src/lib/announcementReads.ts — remembers which announcements this phone has already shown.
// TODO: move to the backend (announcement_reads table) so it follows the user across devices.
import * as SecureStore from 'expo-secure-store';

const KEY = 'read_announcements';

export async function getReadIds(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function markRead(ids: string[]) {
  const current = await getReadIds();
  // keep the newest 100 so the stored list stays small
  const merged = Array.from(new Set([...ids, ...current])).slice(0, 100);
  await SecureStore.setItemAsync(KEY, JSON.stringify(merged));
}