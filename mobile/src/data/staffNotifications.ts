// src/data/staffNotifications.ts  —  the staff bell icon: in-app notifications from the server
import { api } from '../lib/api';

export type StaffNotification = {
  id: string;
  kind: 'schedule' | 'started' | 'report_resolved';
  title: string;
  body: string;
  link: string; // screen to open when tapped, e.g. "/dashboard", "/assistant"
  read: boolean;
  created_at: string;
};

export const fetchStaffNotifications = () =>
  api<{ unread: number; notifications: StaffNotification[] }>('/distribution/notifications');

export const fetchStaffUnreadCount = async () =>
  (await api<{ unread: number }>('/distribution/notifications/unread')).unread;

/** Marks the given notifications read, or all of them when no ids are given. Returns the new unread count. */
export const markStaffNotificationsRead = async (ids?: string[]) =>
  (await api<{ unread: number }>('/distribution/notifications/read', { body: { ids: ids ?? [] } })).unread;