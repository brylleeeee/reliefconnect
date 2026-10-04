import { useState } from 'react'
import { Plus } from 'lucide-react'
import api, { errorMessage } from '../api/client'

const ADD = '__add__'

/**
 * "Source" drop-down, grouped by type (Donation, LGU fund, Government allocation).
 * The last option, "+ Add new source", shows a type and name field; once saved,
 * the source joins the list and is selected.
 */
export default function SourceSelect({ id, sources, types, value, onChange, onSourceAdded }) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ type: 'donation', name: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!draft.name.trim()) return
    setBusy(true); setError('')
    try {
      const r = await api.post('/admin/sources', draft)
      onSourceAdded(r.data)
      onChange(String(r.data.id))
      setAdding(false); setDraft({ type: 'donation', name: '' })
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  return (
    <>
      <select id={id} className="form-select" value={adding ? ADD : value}
              onChange={(e) => {
                if (e.target.value === ADD) { setAdding(true); return }
                setAdding(false); onChange(e.target.value)
              }}>
        <option value="">Not recorded</option>
        {types.map((t) => {
          const list = sources.filter((s) => s.type === t.key)
          return list.length > 0 && (
            <optgroup key={t.key} label={t.label}>
              {list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </optgroup>
          )
        })}
        <option value={ADD}>+ Add new source…</option>
      </select>

      {adding && (
        <div className="rc-recipient-panel">
          <div className="small fw-semibold mb-1">New source</div>
          <select className="form-select form-select-sm mb-2" aria-label="Source type" value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
            {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <div className="d-flex gap-2">
            <input className="form-control form-control-sm flex-grow-1" style={{ minWidth: 0 }} autoFocus
                   aria-label="New source name" maxLength={150} value={draft.name}
                   placeholder={{ donation: 'e.g. Jollibee Foundation', lgu_fund: 'e.g. Municipal Calamity Fund',
                     government_allocation: 'e.g. DSWD Field Office I' }[draft.type]}
                   onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                   onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }} />
            <button type="button" className="btn btn-sm btn-rc d-flex align-items-center gap-1 text-nowrap"
                    disabled={busy || !draft.name.trim()} onClick={save}>
              <Plus size={13} /> {busy ? 'Saving…' : 'Save source'}
            </button>
            <button type="button" className="btn btn-sm btn-light" onClick={() => { setAdding(false); setDraft({ type: 'donation', name: '' }) }}>Cancel</button>
          </div>
        </div>
      )}
      {error && <div className="small text-danger mt-1">{error}</div>}
    </>
  )
}
