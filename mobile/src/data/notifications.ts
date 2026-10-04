// src/data/notifications.ts  —  the bell icon: in-app notifications from the server
import { api } from '../lib/api';

export type AppNotification = {
  id: string;
  kind:
    | 'schedule' | 'started' | 'reminder'            // distributions in your barangay
    | 'approved' | 'rejected' | 'eligible' | 'released' // your household
    | 'sos_received' | 'sos_served'                  // your SOS
    | 'security'                                     // new login, QR reset
    | 'announcement';                                // older notifications only
  title: string;
  body: string;
  link: string; // screen to open when tapped, e.g. "/announcements"
  read: boolean;
  created_at: string;
};

export const fetchNotifications = () =>
  api<{ unread: number; notifications: AppNotification[] }>('/resident/notifications');

export const fetchUnreadCount = async () =>
  (await api<{ unread: number }>('/resident/notifications/unread')).unread;

/** Marks the given notifications read, or all of them when no ids are given. Returns the new unread count. */
export const markNotificationsRead = async (ids?: string[]) =>
  (await api<{ unread: number }>('/resident/notifications/read', { body: { ids: ids ?? [] } })).unread;
