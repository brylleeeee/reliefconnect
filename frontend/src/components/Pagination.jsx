import { useEffect, useState } from 'react'

export default function Pagination({ meta, onPage }) {
  if (!meta || meta.last_page <= 1) return null
  return (
    <div className="d-flex justify-content-between align-items-center mt-3 small text-secondary">
      <span>Showing {meta.from}–{meta.to} of {meta.total}</span>
      <div className="d-flex gap-2">
        <button className="btn btn-sm btn-rc-outline" disabled={meta.current_page === 1}
                onClick={() => onPage(meta.current_page - 1)}>Previous</button>
        <button className="btn btn-sm btn-rc-outline" disabled={meta.current_page === meta.last_page}
                onClick={() => onPage(meta.current_page + 1)}>Next</button>
      </div>
    </div>
  )
}

/**
 * Pages a list that is already loaded in the browser and returns the rows to show plus a `meta`
 * shaped like Laravel's, so <Pagination> works the same. The page is clamped, because a live
 * refresh or a filter change can make the list shorter than the page the user was on.
 */
export function pageOf(list, page, perPage) {
  const total = list.length
  const last = Math.max(1, Math.ceil(total / perPage))
  const current = Math.min(Math.max(1, page), last)
  const start = (current - 1) * perPage
  const rows = list.slice(start, start + perPage)
  return { rows, meta: { current_page: current, last_page: last, total, from: start + 1, to: start + rows.length } }
}

/**
 * Client-side paging for a list the page already loaded: returns the rows for the current page,
 * a Laravel-style `meta` for <Pagination>, and setPage. Goes back to page 1 when `resetKey` changes
 * (e.g. a different tab, filter or selected item).
 */
export function usePaged(list, perPage = 10, resetKey = null) {
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [resetKey])
  const { rows, meta } = pageOf(list ?? [], page, perPage)
  return { rows, meta, setPage }
}
