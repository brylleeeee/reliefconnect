import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { errorMessage } from '../api/client'

const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Grandchild', 'Relative', 'Other']
const blankMember = (relationship = 'Child') => ({
  full_name: '', relationship, birthdate: '', sex: '', is_pwd: false, is_pregnant: false,
})

function fromHousehold(h) {
  if (!h) return { purok: '', address: '', contact_number: '', is_solo_parent: false, members: [blankMember('Head')] }
  return {
    purok: h.purok ?? '', address: h.address ?? '', contact_number: h.contact_number ?? '',
    is_solo_parent: !!h.is_solo_parent,
    members: h.members.map(({ full_name, relationship, birthdate, sex, is_pwd, is_pregnant }) =>
      ({ full_name, relationship, birthdate, sex, is_pwd, is_pregnant })),
  }
}

/** Shared by Walk-in Registration and Edit Household. */
/**
 * Household details and members. `extra` (optional) is rendered before the buttons and its
 * values are sent with the form, e.g. the resident login section of Walk-in Registration.
 */
export default function HouseholdForm({ household, puroks = [], submitLabel, onSubmit, onCancel, extra, extraValues }) {
  const [form, setForm] = useState(() => fromHousehold(household))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setMember = (i, k, v) => setForm((f) => {
    const members = f.members.map((m, idx) => {
      if (idx !== i) return m
      const next = { ...m, [k]: v }
      if (k === 'sex' && v !== 'F') next.is_pregnant = false
      return next
    })
    return { ...f, members }
  })
  const addMember = () => set('members', [...form.members, blankMember()])
  const removeMember = (i) => set('members', form.members.filter((_, idx) => idx !== i))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await onSubmit({ ...form, ...extraValues, contact_number: form.contact_number || null })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <form onSubmit={submit}>
      <section className="rc-card mb-3">
        <h2 className="rc-card-title">Household information</h2>
        <div className="row g-3">
          <div className="col-md-3">
            <label className="rc-label" htmlFor="purok">Purok</label>
            <input id="purok" className="form-control" required list="purok-list" placeholder="e.g. Purok 3"
                   value={form.purok} onChange={(e) => set('purok', e.target.value)} />
            <datalist id="purok-list">{puroks.map((p) => <option key={p} value={p} />)}</datalist>
          </div>
          <div className="col-md-5">
            <label className="rc-label" htmlFor="address">Address / Sitio</label>
            <input id="address" className="form-control" placeholder="e.g. Sitio Centro, near chapel"
                   value={form.address} onChange={(e) => set('address', e.target.value)} />
          </div>
          <div className="col-md-4">
            <label className="rc-label" htmlFor="contact">Mobile number (for SMS)</label>
            <input id="contact" className="form-control" inputMode="numeric" maxLength={11} placeholder="09XXXXXXXXX"
                   value={form.contact_number} onChange={(e) => set('contact_number', e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        <div className="form-check mt-3">
          <input id="solo" type="checkbox" className="form-check-input" checked={form.is_solo_parent}
                 onChange={(e) => set('is_solo_parent', e.target.checked)} />
          <label htmlFor="solo" className="form-check-label small">Household head is a solo parent</label>
        </div>
      </section>

      <section className="rc-card mb-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="rc-card-title mb-0">Household members ({form.members.length})</h2>
          <button type="button" className="btn btn-sm btn-rc-outline d-flex align-items-center gap-1" onClick={addMember}>
            <Plus size={14} /> Add member
          </button>
        </div>

        <div className="table-responsive">
          <table className="rc-table rc-member-table">
            <thead>
              <tr><th>Full name</th><th>Relationship</th><th>Birthdate</th><th>Sex</th><th>PWD</th><th>Pregnant</th><th /></tr>
            </thead>
            <tbody>
              {form.members.map((m, i) => (
                <tr key={i}>
                  <td>
                    <input className="form-control form-control-sm" required aria-label="Full name"
                           placeholder={i === 0 ? 'Household head' : 'First M. Last'}
                           value={m.full_name} onChange={(e) => setMember(i, 'full_name', e.target.value)} />
                  </td>
                  <td>
                    {i === 0
                      ? <span className="fw-semibold small">Head</span>
                      : <select className="form-select form-select-sm" aria-label="Relationship" value={m.relationship}
                                onChange={(e) => setMember(i, 'relationship', e.target.value)}>
                          {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
                        </select>}
                  </td>
                  <td>
                    <input type="date" className="form-control form-control-sm" required max={today} aria-label="Birthdate"
                           value={m.birthdate} onChange={(e) => setMember(i, 'birthdate', e.target.value)} />
                  </td>
                  <td>
                    <select className="form-select form-select-sm" required aria-label="Sex" value={m.sex}
                            onChange={(e) => setMember(i, 'sex', e.target.value)}>
                      <option value="">–</option><option value="M">M</option><option value="F">F</option>
                    </select>
                  </td>
                  <td className="text-center">
                    <input type="checkbox" className="form-check-input" aria-label="Person with disability"
                           checked={m.is_pwd} onChange={(e) => setMember(i, 'is_pwd', e.target.checked)} />
                  </td>
                  <td className="text-center">
                    <input type="checkbox" className="form-check-input" aria-label="Pregnant" disabled={m.sex !== 'F'}
                           checked={m.is_pregnant} onChange={(e) => setMember(i, 'is_pregnant', e.target.checked)} />
                  </td>
                  <td className="text-end">
                    {i > 0 && (
                      <button type="button" className="btn-icon danger" onClick={() => removeMember(i)} aria-label="Remove member">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small text-secondary mb-0 mt-2">
          Seniors, infants, PWDs and pregnant members raise the household's priority score automatically.
        </p>
      </section>

      {extra}

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <div className="d-flex justify-content-end gap-2">
        {onCancel && <button type="button" className="btn btn-light" onClick={onCancel}>Cancel</button>}
        <button className="btn btn-rc" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  )
}
