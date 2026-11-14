// src/data/announcements.ts  —  the resident's barangay announcements
import { api } from '../lib/api';

export type Announcement = {
  id: string;
  author: string;
  time: string;
  title: string;
  body: string;
  postedBy: string;
  category: string | null;
  publishedAt: string | null; // ISO date, for the full date on the details screen
  distribution: DistributionInfo | null; // set when the announcement is about a relief distribution
};

/** The real details of a distribution, for this resident's household. */
export type DistributionInfo = {
  event: string;
  item: string;
  contents: string | null;
  isCash: boolean;
  youGet: string | null; // "1 Pack" / "₱1,000 cash"; null when this household isn't eligible
  whoCanClaim: string;
  status: 'unscheduled' | 'scheduled' | 'ongoing' | 'closed';
  scheduledAt: string | null;
  venue: string | null;
  claimBy: string | null; // YYYY-MM-DD
  notes: string | null;
  claimedAt: string | null; // set when this household already received it
};

type ApiAnnouncement = {
  id: number;
  category: string | null;
  title: string;
  description: string;
  published_at: string | null;
  source_announcement_id: number | null; // set when the barangay relays an LGU announcement
  barangay: { id: number; name: string } | null;
  distribution?: {
    event: string; item: string; contents: string | null; is_cash: boolean; you_get: string | null;
    who_can_claim: string; status: DistributionInfo['status']; scheduled_at: string | null; venue: string | null;
    claim_by: string | null; notes: string | null; claimed_at: string | null;
  } | null; // older servers don't send it
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

/** Full date and time, e.g. "Thursday, November 12, 2026 · 9:30 AM" */
export function fullDate(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`;
}

// The last list fetched, so the details screen opens instantly without loading again
let lastList: Announcement[] = [];

export async function fetchAnnouncements(): Promise<Announcement[]> {
  // the newest 100; the Announcements screen shows them 10 per page
  const res = await api<{ data: ApiAnnouncement[] }>('/resident/announcements?per_page=100');
  lastList = res.data.map((a) => ({
    id: String(a.id),
    author: a.source_announcement_id ? 'LGU Urbiztondo' : `Barangay ${a.barangay?.name ?? ''}`.trim(),
    time: formatTime(a.published_at),
    title: a.title,
    body: a.description,
    postedBy: a.source_announcement_id
      ? `Relayed by Barangay ${a.barangay?.name ?? ''}`.trim()
      : a.category ?? 'Official Bulletin',
    category: a.category,
    publishedAt: a.published_at,
    distribution: a.distribution
      ? {
          event: a.distribution.event,
          item: a.distribution.item,
          contents: a.distribution.contents,
          isCash: a.distribution.is_cash,
          youGet: a.distribution.you_get,
          whoCanClaim: a.distribution.who_can_claim,
          status: a.distribution.status,
          scheduledAt: a.distribution.scheduled_at,
          venue: a.distribution.venue,
          claimBy: a.distribution.claim_by,
          notes: a.distribution.notes,
          claimedAt: a.distribution.claimed_at,
        }
      : null,
  }));
  return lastList;
}

/** One announcement for the details screen: from the last list, or loaded again (e.g. opened from a notification). */
export async function getAnnouncement(id: string): Promise<Announcement | null> {
  const found = lastList.find((a) => a.id === id);
  if (found) return found;
  return (await fetchAnnouncements()).find((a) => a.id === id) ?? null;
}

export type Tone = 'green' | 'blue' | 'amber' | 'gray';
export type DistributionStatus = { label: string; detail: string; tone: Tone; live: boolean };

/** Countdown text, e.g. "in 2 days", "in 5 hours", "in 12 minutes" */
function until(iso: string, now: number) {
  const mins = Math.round((new Date(iso).getTime() - now) / 60000);
  if (mins < 60) return `in ${Math.max(1, mins)} minute${mins === 1 ? '' : 's'}`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

/** Day name for a date: "Today", "Tomorrow", or "Thu, Nov 12" */
export function dayName(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

/** Where this distribution stands for the household, for the status chip and banner. */
export function distributionStatus(d: DistributionInfo, now = Date.now()): DistributionStatus {
  if (d.claimedAt) {
    const day = dayName(d.claimedAt);
    const when = day === 'Today' ? 'today' : `on ${day}`;
    return { label: 'Claimed', detail: `Your household received this ${when} at ${clockTime(d.claimedAt)}`, tone: 'green', live: false };
  }
  if (d.status === 'closed') return { label: 'Ended', detail: 'This distribution is already closed', tone: 'gray', live: false };
  if (!d.youGet) return { label: 'Not for you', detail: `Only for ${d.whoCanClaim.toLowerCase()}`, tone: 'gray', live: false };
  if (d.status === 'ongoing') return { label: 'Happening now', detail: 'Go to the venue now and bring your QR code', tone: 'green', live: true };
  if (d.status === 'scheduled' && d.scheduledAt) {
    const starts = new Date(d.scheduledAt).getTime();
    if (starts <= now) return { label: 'Starting soon', detail: 'Staff are getting ready at the venue', tone: 'amber', live: true };
    return { label: dayName(d.scheduledAt), detail: `Starts ${until(d.scheduledAt, now)}`, tone: 'blue', live: false };
  }
  return { label: 'Date to follow', detail: 'Your barangay will announce the day soon', tone: 'amber', live: false };
}
