import { useState } from 'react'
import { Plus } from 'lucide-react'
import api, { errorMessage } from '../api/client'

const ADD = '__add__'

/**
 * Source / donor drop-down. The last option, "+ Add new donor", shows a text field;
 * once saved, the donor joins the list and is selected.
 */
export default function DonorSelect({ id, donors, value, onChange, onDonorAdded }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!name.trim()) return
    setBusy(true); setError('')
    try {
      const r = await api.post('/admin/donors', { name })
      onDonorAdded(r.data)
      onChange(String(r.data.id))
      setAdding(false); setName('')
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
        {donors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        <option value={ADD}>+ Add new donor…</option>
      </select>
      {adding && (
        <div className="d-flex gap-2 mt-2">
          <input className="form-control form-control-sm flex-grow-1" style={{ minWidth: 0 }} placeholder="Donor name, e.g. Jollibee Foundation" autoFocus
                 aria-label="New donor name" value={name} maxLength={150}
                 onChange={(e) => setName(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }} />
          <button type="button" className="btn btn-sm btn-rc d-flex align-items-center gap-1 text-nowrap"
                  disabled={busy || !name.trim()} onClick={save}>
            <Plus size={13} /> {busy ? 'Saving…' : 'Save donor'}
          </button>
          <button type="button" className="btn btn-sm btn-light" onClick={() => { setAdding(false); setName('') }}>Cancel</button>
        </div>
      )}
      {error && <div className="small text-danger mt-1">{error}</div>}
    </>
  )
}
