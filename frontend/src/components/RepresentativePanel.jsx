import { useState } from 'react'
import { UserCheck } from 'lucide-react'
import api, { errorMessage } from '../api/client'

const RELATIONSHIPS = ['Son', 'Daughter', 'Grandchild', 'Sibling', 'Niece/Nephew', 'Relative', 'Neighbor', 'Caregiver', 'Other']
const EMPTY = { full_name: '', relationship: 'Son', birthdate: '', contact_number: '' }

/**
 * Authorized representative (adviser): someone outside the household, e.g. a son caring for his senior parents,
 * who may claim its relief, like an authorization letter. Not a member, so not counted in the priority score.
 * `onChange` makes it editable (Household Records); without it the panel is read-only (QR Review).
 */
export default function RepresentativePanel({ h, onChange }) {
  const rep = h.representative
  const [form, setForm] = useState(null) // null = not editing
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!rep && !onChange) return null
  const canEdit = onChange && h.status !== 'rejected'
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async () => {
    setBusy(true); setError('')
    try {
      await api.put(`/barangay/households/${h.id}/representative`, { ...form, contact_number: form.contact_number || null })
      setForm(null); onChange()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!window.confirm(`Remove ${rep.full_name} as representative? They will no longer be able to claim for this household.`)) return
    setBusy(true); setError('')
    try { await api.delete(`/barangay/households/${h.id}/representative`); onChange() }
    catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <section className="border rounded-3 p-3 mb-3">
      <div className="d-flex align-items-center gap-2 mb-1">
        <UserCheck size={16} className="text-success" />
        <div className="fw-semibold small">Authorized representative</div>
        {canEdit && !form && (
          <div className="ms-auto d-flex gap-2">
            {rep && <button className="btn btn-sm btn-light" disabled={busy} onClick={remove}>Remove</button>}
            <button className="btn btn-sm btn-rc-outline" onClick={() => setForm(rep
              ? { full_name: rep.full_name, relationship: rep.relationship, birthdate: rep.birthdate, contact_number: rep.contact_number ?? '' }
              : EMPTY)}>
              {rep ? 'Change' : 'Add Representative'}
            </button>
          </div>
        )}
      </div>

      {!form && (rep ? (
        <div className="small">
          <b>{rep.full_name}</b> · {rep.relationship}{rep.contact_number ? ` · ${rep.contact_number}` : ''}
          <div className="text-secondary">
            May claim relief for this household. Staff check their valid ID at release. Not counted as a member.
          </div>
          {h.representative_elsewhere?.length > 0 && (
            <div className="text-secondary mt-1">
              Also registered as: {h.representative_elsewhere.map((x) => `${x.as} of ${x.head}${x.reference_number ? ` (${x.reference_number})` : ''}`).join('; ')}
            </div>
          )}
        </div>
      ) : (
        <p className="small text-secondary mb-0">
          None. Add one when the household can’t claim in person, e.g. seniors living alone whose son or niece
          picks up their relief. One person can represent at most 2 households.
        </p>
      ))}

      {form && (
        <div className="row g-2 mt-1">
          <div className="col-md-6">
            <label className="rc-label" htmlFor="rep-name">Full name</label>
            <input id="rep-name" className="form-control form-control-sm" value={form.full_name} onChange={set('full_name')} maxLength={150} />
          </div>
          <div className="col-md-6">
            <label className="rc-label" htmlFor="rep-rel">Relationship to the household</label>
            <select id="rep-rel" className="form-select form-select-sm" value={form.relationship} onChange={set('relationship')}>
              {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="rc-label" htmlFor="rep-bd">Birthdate (must be 18 or older)</label>
            <input id="rep-bd" type="date" className="form-control form-control-sm" value={form.birthdate} onChange={set('birthdate')} />
          </div>
          <div className="col-md-6">
            <label className="rc-label" htmlFor="rep-phone">Mobile number (optional)</label>
            <input id="rep-phone" className="form-control form-control-sm" placeholder="09171234567" value={form.contact_number} onChange={set('contact_number')} />
          </div>
          {error && <div className="col-12"><div className="alert alert-danger py-2 small mb-0">{error}</div></div>}
          <div className="col-12 d-flex justify-content-end gap-2">
            <button className="btn btn-sm btn-light" onClick={() => { setForm(null); setError('') }}>Cancel</button>
            <button className="btn btn-sm btn-rc" disabled={busy || !form.full_name.trim() || !form.birthdate} onClick={save}>
              {busy ? 'Saving…' : 'Save Representative'}
            </button>
          </div>
        </div>
      )}
      {!form && error && <div className="alert alert-danger py-2 small mt-2 mb-0">{error}</div>}
    </section>
  )
}
