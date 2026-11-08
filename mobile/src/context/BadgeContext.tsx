// src/context/BadgeContext.tsx
// Keeps the unread counts for the bell and the Announcements tab up to date automatically.
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useResident } from './ResidentContext';
import { fetchUnreadCount } from '../data/notifications';
import { fetchAnnouncements } from '../data/announcements';
import { getReadIds } from '../lib/announcementReads';

const POLL_MS = 20000;

type BadgeContextValue = {
  /** null = not loaded yet or not a resident account (the bell stays hidden) */
  notifications: number | null;
  announcements: number;
  /** Re-checks the server now. Call it after marking something as read. */
  refresh: () => Promise<void>;
};

const BadgeContext = createContext<BadgeContextValue | null>(null);

export function BadgeProvider({ children }: { children: ReactNode }) {
  const { household } = useResident();
  const loggedIn = !!household;
  const [notifications, setNotifications] = useState<number | null>(null);
  const [announcements, setAnnouncements] = useState(0);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    if (!loggedIn) return;
    const mine = ++seq.current; // drop a slow response that arrives after a newer one
    const [count, list, read] = await Promise.all([
      fetchUnreadCount().catch(() => null),
      fetchAnnouncements().catch(() => null),
      getReadIds(),
    ]);
    if (mine !== seq.current) return;
    if (count !== null) setNotifications(count);
    if (list) setAnnouncements(list.filter((a) => !read.includes(String(a.id))).length);
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) {
      seq.current++;
      setNotifications(null);
      setAnnouncements(0);
      return;
    }
    refresh();
    let timer = setInterval(refresh, POLL_MS);

    // pause polling in the background, refresh immediately when the app returns
    const appSub = AppState.addEventListener('change', (state) => {
      clearInterval(timer);
      if (state === 'active') {
        refresh();
        timer = setInterval(refresh, POLL_MS);
      }
    });

    // a push arriving while the app is open updates the badges at once
    const pushSub = Notifications.addNotificationReceivedListener(() => { refresh(); });

    return () => {
      clearInterval(timer);
      appSub.remove();
      pushSub.remove();
    };
  }, [loggedIn, refresh]);

  return (
    <BadgeContext.Provider value={{ notifications, announcements, refresh }}>
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadges() {
  const ctx = useContext(BadgeContext);
  if (!ctx) throw new Error('useBadges must be used inside BadgeProvider');
  return ctx;
}
