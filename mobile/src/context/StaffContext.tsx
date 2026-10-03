// src/context/StaffContext.tsx
// The logged-in distribution staff member, the distributions running now, and the one being served.
import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { api } from '../lib/api';
import { currentUser, User } from '../lib/auth';

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

  const reload = useCallback(async () => {
    const [me, list] = await Promise.all([currentUser(), api<StaffEvent[]>('/distribution/events')]);
    setUser(me);
    setEvents(list);
    // Keep the current choice if it's still running; auto-pick when there is only one
    setSelectedKey((cur) =>
      cur && list.some((e) => keyOf(e) === cur) ? cur : list.length === 1 ? keyOf(list[0]) : null);
  }, []);

  const selected = events?.find((e) => keyOf(e) === selectedKey) ?? null;

  return (
    <StaffContext.Provider value={{ user, events, selected, select: (e) => setSelectedKey(keyOf(e)), reload }}>
      {children}
    </StaffContext.Provider>
  );
}

export function useStaff() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error('useStaff must be used inside StaffProvider');
  return ctx;
}
