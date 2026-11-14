// src/data/notificationPreferences.ts  —  Account → Notification Preferences
// Saved on the server, because the server decides which push notifications to send
// (with the app closed, the phone shows a push without running any app code).
import { api } from '../lib/api';

export type PrefCategory = 'distributions' | 'announcements' | 'household' | 'sos' | 'reports';

export type NotificationPrefs = {
  enabled: boolean;       // phone notifications at all (security ones are always sent)
  muted: PrefCategory[];  // categories turned off
};

export const fetchPrefs = () => api<NotificationPrefs>('/me/notification-preferences');

export const savePrefs = (prefs: NotificationPrefs) =>
  api<NotificationPrefs>('/me/notification-preferences', { method: 'PUT', body: prefs });
