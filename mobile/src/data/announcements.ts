// src/data/announcements.ts  —  sample data until the API is connected
export type Announcement = {
  id: string;
  author: string;
  time: string;
  title: string;
  body: string;
  postedBy: string;
};

export const announcements: Announcement[] = [
  {
    id: '1',
    author: 'Barangay Admin',
    time: 'Today · 8:00 AM',
    title: 'Nutritional Relief Pack Distribution',
    body: 'Priority collection for senior citizens and pregnant women. Please bring your approved digital Relief QR code.',
    postedBy: 'Posted by Barangay Batancaoa Admin',
  },
  {
    id: '2',
    author: 'Barangay Admin',
    time: 'Yesterday',
    title: 'Class Suspensions & Flood Advisory',
    body: 'Due to southwest monsoon rains, classes in all levels are suspended. Emergency rescue boat standby at Purok 4.',
    postedBy: 'Posted by Barangay Batancaoa Admin',
  },
  {
    id: '3',
    author: 'Barangay Admin',
    time: 'Jan 24, 2026',
    title: 'First Quarter Community Assembly',
    body: 'Discussion of localized barangay health programs, livelihood support initiatives, and distribution feedback.',
    postedBy: 'Posted by Barangay Batancaoa Admin',
  },
];