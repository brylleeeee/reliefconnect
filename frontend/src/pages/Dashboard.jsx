import { useEffect, useState } from 'react'
import { Send, SquarePen, Trash2 } from 'lucide-react'
import api, { errorMessage } from '../api/client'
import PageHeader from '../components/PageHeader'

const emptyForm = { title: '', description: '' }

function formatWhen(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return `Today · ${time}`
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [advisories, setAdvisories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    api.get('/admin/dashboard/stats').then((r) => setStats(r.data))
    api.get('/admin/announcements').then((r) => setAdvisories(r.data.data))
  }
  useEffect(load, [])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      if (editingId) await api.put(`/admin/announcements/${editingId}`, form)
      else await api.post('/admin/announcements', form)
      setForm(emptyForm); setEditingId(null)
      load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (a) => {
    setEditingId(a.id)
    setForm({ title: a.title, description: a.description })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const remove = async (a) => {
    if (!confirm(`Delete "${a.title}"? Residents will no longer see it.`)) return
    await api.delete(`/admin/announcements/${a.id}`)
    load()
  }

  return (
    <>
      <PageHeader title="Dashboard & Communications" subtitle="Municipal disaster response administration dashboard" />

      <div className="row g-3 mb-3">
        <div className="col-lg-8">
          <form className="rc-card h-100" onSubmit={submit}>
            <h2 className="rc-card-title">
              {editingId ? 'Edit Announcement' : 'Post New Announcement / Distribution Advisory'}
            </h2>
            {error && <div className="alert alert-danger py-2 small">{error}</div>}

            <label className="rc-label" htmlFor="ann-title">Title</label>
            <input id="ann-title" className="form-control mb-3" required maxLength={150}
                   placeholder="e.g. Schedule of Food Pack Distribution for Purok 3 & 4"
                   value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />

            <label className="rc-label" htmlFor="ann-desc">Description</label>
            <textarea id="ann-desc" className="form-control mb-3" rows={3} required maxLength={2000}
                      placeholder="Provide detailed coordinates: location (Barangay Hall), timeline, and required documentation (Digital Relief QR Code or valid LGU ID)..."
                      value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

            <div className="d-flex justify-content-end gap-2">
              {editingId && (
                <button type="button" className="btn btn-light btn-sm"
                        onClick={() => { setEditingId(null); setForm(emptyForm) }}>Cancel</button>
              )}
              <button className="btn btn-rc d-flex align-items-center gap-2" disabled={busy}>
                <Send size={14} /> {editingId ? 'Save Changes' : 'Publish Announcement'}
              </button>
            </div>
          </form>
        </div>

        <div className="col-lg-4 d-flex flex-column gap-3">
          <div className="rc-stat green">
            <div className="rc-stat-label">Active Registered Households</div>
            <div className="rc-stat-value green">{stats ? stats.active_households.toLocaleString() : '—'}</div>
          </div>
          <div className="rc-stat blue">
            <div className="rc-stat-label">Pending QR Approvals</div>
            <div className="rc-stat-value blue">{stats ? stats.pending_qr_approvals.toLocaleString() : '—'}</div>
          </div>
        </div>
      </div>

      <section className="rc-card">
        <h2 className="rc-card-title">Previously Published Advisories</h2>
        {advisories.length === 0 && (
          <p className="text-secondary small mb-0">No advisories yet. Publish one above to notify residents.</p>
        )}
        {advisories.map((a) => (
          <div className="rc-advisory" key={a.id}>
            <div className="flex-grow-1">
              <div>
                <span className="rc-advisory-tag">{a.category}</span>
                <span className="rc-advisory-time">{formatWhen(a.published_at)}</span>
              </div>
              <div className="rc-advisory-title">{a.title}</div>
              <div className="rc-advisory-desc">{a.description}</div>
            </div>
            <button className="btn-icon" onClick={() => startEdit(a)} aria-label="Edit"><SquarePen size={14} /></button>
            <button className="btn-icon danger" onClick={() => remove(a)} aria-label="Delete"><Trash2 size={14} /></button>
          </div>
        ))}
      </section>
    </>
  )
}
