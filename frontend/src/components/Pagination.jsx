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
