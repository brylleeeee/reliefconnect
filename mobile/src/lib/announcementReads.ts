// src/lib/announcementReads.ts — remembers which announcements this phone has already shown.
// TODO: move to the backend (announcement_reads table) so it follows the user across devices.
// Uses AsyncStorage (not SecureStore): the IDs are not secret, and SecureStore does not work on web.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'read_announcements';

export async function getReadIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function markRead(ids: string[]) {
  try {
    const current = await getReadIds();
    // keep the newest 100 so the stored list stays small
    const merged = Array.from(new Set([...ids, ...current])).slice(0, 100);
    await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // not being able to remember read announcements must never crash the app
  }
}