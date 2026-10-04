// src/lib/offline.ts  —  offline mode for distribution staff (team decision):
//  1. While online, the phone downloads the household list of the distribution being served.
//  2. Offline, Manual Entry checks reference numbers against that list, and releases are
//     saved in a queue on the phone.
//  3. Back online, the queue is sent to the server. A claim the server rejects (e.g. another
//     offline phone released to the same household first) is kept as a "sync problem".
// QR scanning stays online-only: the list never contains QR secrets.
// The list is deleted when its distribution is no longer running and when staff log out.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, errorText } from './api';
import type { User } from './auth';

export type PackHousehold = {
  reference_number: string;
  household_head: string;
  purok: string | null;
  members_count: number;
  priority_level: 'high' | 'medium' | 'low';
  quantity: number;
  claimed_at: string | null;
};

export type OfflinePack = {
  event_id: number;
  barangay_id: number;
  unit: string;
  quota: number;
  claimed: number;
  downloaded_at: string;
  households: PackHousehold[];
};

export type QueuedClaim = {
  eventId: number;
  barangayId: number;
  reference: string;
  head: string;
  distributedAt: string; // when the aid was actually handed over
};

export type SyncProblem = QueuedClaim & { reason: string };

const PACK_PREFIX = 'offline_pack_';
const QUEUE_KEY = 'offline_queue';
const PROBLEMS_KEY = 'offline_problems';
const STAFF_KEY = 'offline_staff'; // staff account + running distributions, to open the app offline

const packKey = (eventId: number, barangayId: number) => `${PACK_PREFIX}${eventId}_${barangayId}`;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const writeJson = (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value));

/** True when the request failed because the server couldn't be reached (no internet). */
export const isOfflineError = (e: unknown) => e instanceof ApiError && e.status === 0;

// ---------- household list ----------

export async function downloadPack(eventId: number, barangayId: number): Promise<OfflinePack> {
  const pack = await api<OfflinePack>(`/distribution/events/${eventId}/offline-pack`, {
    query: { barangay_id: barangayId },
  });
  // Releases still waiting in this phone's queue stay "claimed" in the fresh list
  const queue = await getQueue();
  for (const q of queue) {
    if (q.eventId !== eventId || q.barangayId !== barangayId) continue;
    const h = pack.households.find((x) => x.reference_number === q.reference);
    if (h && !h.claimed_at) h.claimed_at = q.distributedAt;
  }
  await writeJson(packKey(eventId, barangayId), pack);
  return pack;
}

export const getPack = (eventId: number, barangayId: number) =>
  readJson<OfflinePack | null>(packKey(eventId, barangayId), null);

/** Deletes lists of distributions that are no longer running (called with the running ones). */
export async function prunePacks(running: { event_id: number; barangay_id: number }[]) {
  const keep = new Set(running.map((e) => packKey(e.event_id, e.barangay_id)));
  const keys = await AsyncStorage.getAllKeys();
  const old = keys.filter((k) => k.startsWith(PACK_PREFIX) && !keep.has(k));
  if (old.length) await AsyncStorage.multiRemove(old);
}

/** The offline version of the server's "check": can this household claim? */
export function checkOffline(pack: OfflinePack, reference: string) {
  const ref = reference.trim().toUpperCase();
  const h = pack.households.find((x) => x.reference_number === ref);
  if (!h) {
    return {
      household: null,
      reason: 'This reference number is not in the downloaded list for this distribution. ' +
        'Check the number, or connect to the internet to check it online.',
    };
  }
  return { household: h, reason: h.claimed_at ? 'This household already claimed for this event.' : null };
}

// ---------- release queue ----------

export const getQueue = () => readJson<QueuedClaim[]>(QUEUE_KEY, []);
export const getProblems = () => readJson<SyncProblem[]>(PROBLEMS_KEY, []);
export const clearProblems = () => AsyncStorage.removeItem(PROBLEMS_KEY);

/** Saves an offline release and marks the household claimed in the list on this phone. */
export async function queueClaim(claim: QueuedClaim) {
  await writeJson(QUEUE_KEY, [...(await getQueue()), claim]);

  const pack = await getPack(claim.eventId, claim.barangayId);
  const h = pack?.households.find((x) => x.reference_number === claim.reference);
  if (pack && h) {
    h.claimed_at = claim.distributedAt;
    await writeJson(packKey(claim.eventId, claim.barangayId), pack);
  }
}

let syncing: Promise<{ sent: number; failed: number }> | null = null;

/**
 * Sends queued releases, oldest first. Stops (keeping the rest) if the internet drops again.
 * Claims the server refuses become sync problems for staff to report to their barangay admin.
 */
export function syncQueue(): Promise<{ sent: number; failed: number }> {
  syncing ??= (async () => {
    let sent = 0;
    let failed = 0;
    const queue = await getQueue();
    const same = (a: QueuedClaim, b: QueuedClaim) =>
      a.eventId === b.eventId && a.reference === b.reference && a.distributedAt === b.distributedAt;

    for (const claim of queue) {
      try {
        await api(`/distribution/events/${claim.eventId}/claims`, {
          body: { reference_number: claim.reference, synced_from_offline: true, distributed_at: claim.distributedAt },
        });
        sent++;
      } catch (e) {
        if (isOfflineError(e)) break; // still offline: try again later
        failed++;
        await writeJson(PROBLEMS_KEY, [...(await getProblems()), { ...claim, reason: errorText(e) }]);
      }
      // re-read the queue: a new offline release may have been added while this one was sending
      await writeJson(QUEUE_KEY, (await getQueue()).filter((q) => !same(q, claim)));
    }
    return { sent, failed };
  })().finally(() => { syncing = null; });

  return syncing;
}

// ---------- opening the app offline ----------

export async function cacheStaff(user: User, events: unknown[]) {
  await writeJson(STAFF_KEY, { user, events });
}

export const getCachedStaff = <E>() => readJson<{ user: User; events: E[] } | null>(STAFF_KEY, null);

/** On logout: delete every household list and the cached account. The queue must be empty first. */
export async function clearOfflineData() {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PACK_PREFIX) || k === STAFF_KEY || k === PROBLEMS_KEY));
}
