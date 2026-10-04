import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import api, { errorMessage } from '../api/client'
import Modal from './Modal'
import RecipientPicker from './RecipientPicker'

const allBarangays = { mode: 'all', ids: [] }

/**
 * LGU: create or edit an announcement to barangays.
 * editing = an announcement from the list, or null to create a new one.
 */
export default function LguAnnouncementModal({ editing, onClose, onSaved }) {
  const [barangays, setBarangays] = useState([])
  const [form, setForm] = useState({ title: editing?.title ?? '', description: editing?.description ?? '' })
  const [recipients, setRecipients] = useState(() => {
    const ids = editing?.target_barangays?.map((b) => b.id) ?? []
    return ids.length ? { mode: 'selected', ids } : allBarangays
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { api.get('/admin/barangays').then((r) => setBarangays(r.data)) }, [])

  const noRecipients = recipients.mode === 'selected' && recipients.ids.length === 0

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const payload = { ...form, barangay_ids: recipients.mode === 'all' ? [] : recipients.ids }
      if (editing) await api.put(`/admin/announcements/${editing.id}`, payload)
      else await api.post('/admin/announcements', payload)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={editing ? 'Edit Announcement' : 'Publish Announcement'} size="lg" onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <label className="rc-label" htmlFor="ann-title">Title</label>
        <input id="ann-title" className="form-control mb-3" required maxLength={150} autoFocus
               placeholder="e.g. Schedule of Food Pack Distribution for Purok 3 & 4"
               value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />

        <label className="rc-label" htmlFor="ann-desc">Description</label>
        <textarea id="ann-desc" className="form-control mb-3" rows={4} required maxLength={2000}
                  placeholder="Location, schedule, and what residents need to bring (ReliefConnect QR code or valid ID)."
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

        <RecipientPicker value={recipients} onChange={setRecipients} barangays={barangays} />

        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
          <button className="btn btn-rc d-flex align-items-center gap-2" disabled={busy || noRecipients}>
            <Send size={14} /> {busy ? 'Saving…' : editing ? 'Save Changes' : 'Publish Announcement'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
