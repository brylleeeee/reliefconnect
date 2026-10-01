import { useState } from 'react'
import api, { errorMessage } from '../api/client'
import Modal from './Modal'

/**
 * Barangay: announce to the barangay's own residents.
 * initial = { title, description, source_announcement_id?, distribution_event_id? }
 * When editing, pass the announcement's id as `editingId`.
 */
export default function AnnounceModal({ initial, editingId, onClose, onSaved, note }) {
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      if (editingId) await api.put(`/barangay/announcements/${editingId}`, form)
      else await api.post('/barangay/announcements', form)
      onSaved?.()
    } catch (err) {
      setError(errorMessage(err))
    } finally { setBusy(false) }
  }

  return (
    <Modal title={editingId ? 'Edit Announcement' : 'Announce to Residents'} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <p className="small text-secondary">
          {note ?? 'Residents of your barangay will see this in the ReliefConnect app.'}
        </p>
        <label className="rc-label" htmlFor="ann-b-title">Title</label>
        <input id="ann-b-title" className="form-control mb-3" required maxLength={150}
               value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <label className="rc-label" htmlFor="ann-b-desc">Message</label>
        <textarea id="ann-b-desc" className="form-control mb-4" rows={5} required maxLength={2000}
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button className="btn btn-rc w-100" disabled={busy}>
          {busy ? 'Publishing…' : editingId ? 'Save Changes' : 'Publish to Residents'}
        </button>
      </form>
    </Modal>
  )
}
