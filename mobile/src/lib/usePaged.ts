// src/lib/usePaged.ts  —  page a list that is already loaded (10 per page by default)
import { RefObject, useEffect, useState } from 'react';

type Scrollable = {
  scrollToOffset?: (p: { offset: number; animated?: boolean }) => void; // FlatList
  scrollTo?: (p: { y: number; animated?: boolean }) => void;            // ScrollView
};

export type PageMeta = { page: number; last: number; total: number; from: number; to: number };

/**
 * Returns the rows of the current page, the page info for <Pager>, and goTo(page).
 * Goes back to page 1 when `resetKey` changes (e.g. a different filter). If `scrollRef` is given,
 * changing the page scrolls the list back to the top so the new page starts at its first row.
 */
export function usePaged<T>(
  list: T[] | null | undefined,
  perPage = 10,
  resetKey: unknown = null,
  scrollRef?: RefObject<Scrollable | null>,
) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [resetKey]);

  const items = list ?? [];
  const last = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(page, last); // the list can get shorter on a refresh
  const start = (current - 1) * perPage;
  const rows = items.slice(start, start + perPage);
  const meta: PageMeta = { page: current, last, total: items.length, from: start + 1, to: start + rows.length };

  const goTo = (p: number) => {
    setPage(Math.min(Math.max(1, p), last));
    const s = scrollRef?.current;
    if (s?.scrollToOffset) s.scrollToOffset({ offset: 0, animated: true });
    else if (s?.scrollTo) s.scrollTo({ y: 0, animated: true });
  };

  return { rows, meta, goTo };
}
