// src/data/announcements.ts  —  the resident's barangay announcements
import { api } from '../lib/api';

export type Announcement = {
  id: string;
  author: string;
  time: string;
  title: string;
  body: string;
  postedBy: string;
};

type ApiAnnouncement = {
  id: number;
  category: string | null;
  title: string;
  description: string;
  published_at: string | null;
  source_announcement_id: number | null; // set when the barangay relays an LGU announcement
  barangay: { id: number; name: string } | null;
};

function formatTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today · ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const res = await api<{ data: ApiAnnouncement[] }>('/resident/announcements');
  return res.data.map((a) => ({
    id: String(a.id),
    author: a.source_announcement_id ? 'LGU Urbiztondo' : `Barangay ${a.barangay?.name ?? ''}`.trim(),
    time: formatTime(a.published_at),
    title: a.title,
    body: a.description,
    postedBy: a.source_announcement_id
      ? `Relayed by Barangay ${a.barangay?.name ?? ''}`.trim()
      : a.category ?? 'Official Bulletin',
  }));
}
