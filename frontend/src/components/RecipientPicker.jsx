import { useMemo, useState } from 'react'
import { Building2, CheckSquare, Search, Users } from 'lucide-react'

/**
 * Chooses which barangays receive an LGU announcement.
 * value: { mode: 'all' | 'selected', ids: number[] }
 * barangays: [{ id, name, households }]
 */
export default function RecipientPicker({ value, onChange, barangays }) {
  const [query, setQuery] = useState('')
  const { mode, ids } = value
  const shown = useMemo(
    () => barangays.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase())),
    [barangays, query],
  )
  const selected = barangays.filter((b) => ids.includes(b.id))
  const households = (mode === 'all' ? barangays : selected).reduce((n, b) => n + b.households, 0)

  const toggle = (id) => onChange({ mode, ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] })
  const selectShown = () => onChange({ mode, ids: [...new Set([...ids, ...shown.map((b) => b.id)])] })

  return (
    <fieldset className="mb-3">
      <legend className="rc-label">Recipients</legend>

      <div className="rc-recipient-modes">
        <label className={`rc-recipient-mode ${mode === 'all' ? 'active' : ''}`}>
          <input type="radio" name="recipients" checked={mode === 'all'} onChange={() => onChange({ mode: 'all', ids: [] })} />
          <Users size={18} />
          <span>
            <span className="d-block fw-semibold">All barangays</span>
            <span className="small text-secondary">{barangays.length} barangays in Urbiztondo</span>
          </span>
        </label>
        <label className={`rc-recipient-mode ${mode === 'selected' ? 'active' : ''}`}>
          <input type="radio" name="recipients" checked={mode === 'selected'} onChange={() => onChange({ mode: 'selected', ids })} />
          <Building2 size={18} />
          <span>
            <span className="d-block fw-semibold">Selected barangays</span>
            <span className="small text-secondary">Only the barangays you choose</span>
          </span>
        </label>
      </div>

      {mode === 'selected' && (
        <div className="rc-recipient-panel">
          <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
            <div className="rc-search flex-grow-1">
              <Search size={14} />
              <input className="form-control form-control-sm" placeholder="Search barangay" aria-label="Search barangay"
                     value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <button type="button" className="btn btn-link btn-sm p-0 rc-link" onClick={selectShown}>
              <CheckSquare size={13} className="me-1" />Select {query ? 'shown' : 'all'}
            </button>
            <button type="button" className="btn btn-link btn-sm p-0 text-secondary" disabled={!ids.length}
                    onClick={() => onChange({ mode, ids: [] })}>Clear</button>
          </div>

          <div className="rc-recipient-list">
            {shown.map((b) => (
              <label key={b.id} className={`rc-recipient-item ${ids.includes(b.id) ? 'checked' : ''}`}>
                <input type="checkbox" className="form-check-input mt-0" checked={ids.includes(b.id)} onChange={() => toggle(b.id)} />
                <span className="flex-grow-1">{b.name}</span>
                <span className="small text-secondary">{b.households} hh</span>
              </label>
            ))}
            {shown.length === 0 && <div className="small text-secondary p-2">No barangay matches "{query}".</div>}
          </div>
        </div>
      )}

      <div className={`small mt-2 ${mode === 'selected' && !ids.length ? 'text-danger' : 'text-secondary'}`} aria-live="polite">
        {mode === 'all'
          ? `Sending to all ${barangays.length} barangays (${households.toLocaleString()} approved households).`
          : ids.length
            ? `Sending to ${ids.length} of ${barangays.length} barangays: ${selected.map((b) => b.name).join(', ')} (${households.toLocaleString()} approved households).`
            : 'Choose at least one barangay.'}
        {' '}Barangay officials then announce it to their own residents.
      </div>
    </fieldset>
  )
}
