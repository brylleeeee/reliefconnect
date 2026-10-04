// src/context/StaffContext.tsx
// The logged-in distribution staff member, the distributions running now, and the one being served.
// Offline mode: the account and running distributions are cached, so the app still opens without internet.
import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { api } from '../lib/api';
import type { User } from '../lib/auth';
import { cacheStaff, getCachedStaff, isOfflineError, prunePacks } from '../lib/offline';

export type StaffEvent = {
  event_id: number;
  name: string;
  barangay_id: number;
  barangay: string;
  venue: string | null;
  item: string;
  unit: string;
  quantity_per_household: number;
  quota: number;
  claimed: number;
  notes: string | null;
};

type StaffContextValue = {
  user: User | null;
  events: StaffEvent[] | null;
  selected: StaffEvent | null;
  select: (e: StaffEvent) => void;
  /** True when the last reload could not reach the server and cached data is shown. */
  offline: boolean;
  /** Reloads the staff member and ongoing distributions (claimed counts included). */
  reload: () => Promise<void>;
};

const StaffContext = createContext<StaffContextValue | null>(null);

// An event is served per barangay, so one selection = event + barangay
const keyOf = (e: StaffEvent) => `${e.event_id}-${e.barangay_id}`;

export function StaffProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<StaffEvent[] | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const reload = useCallback(async () => {
    let me: User;
    let list: StaffEvent[];
    try {
      [me, list] = await Promise.all([api<User>('/me'), api<StaffEvent[]>('/distribution/events')]);
      setOffline(false);
      await cacheStaff(me, list);
      await prunePacks(list); // a list whose distribution stopped running is deleted from the phone
    } catch (e) {
      const cached = isOfflineError(e) ? await getCachedStaff<StaffEvent>() : null;
      if (!cached) throw e;
      setOffline(true);
      ({ user: me, events: list } = cached);
    }
    setUser(me);
    setEvents(list);
    // Keep the current choice if it's still running; auto-pick when there is only one
    setSelectedKey((cur) =>
      cur && list.some((e) => keyOf(e) === cur) ? cur : list.length === 1 ? keyOf(list[0]) : null);
  }, []);

  const selected = events?.find((e) => keyOf(e) === selectedKey) ?? null;

  return (
    <StaffContext.Provider value={{ user, events, selected, select: (e) => setSelectedKey(keyOf(e)), offline, reload }}>
      {children}
    </StaffContext.Provider>
  );
}

export function useStaff() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error('useStaff must be used inside StaffProvider');
  return ctx;
}
