import { useState } from 'react'
import { FileText } from 'lucide-react'
import api, { errorMessage } from '../api/client'
import { PriorityBadge, StatusBadge } from './Badges'

/** Uploaded documents are private; fetch with the admin's token, then open in a new tab. */
function Documents({ h }) {
  const [error, setError] = useState('')
  if (!h.documents?.length) {
    return h.registration_type === 'online'
      ? <p className="small text-secondary mb-3">No documents uploaded.</p>
      : null
  }
  const open = async (doc) => {
    setError('')
    const win = window.open('', '_blank') // open first so pop-up blockers allow it
    try {
      const r = await api.get(`/barangay/households/${h.id}/documents/${doc.id}`, { responseType: 'blob' })
      win.location.href = URL.createObjectURL(r.data)
    } catch (err) {
      win?.close()
      setError(errorMessage(err))
    }
  }
  return (
    <div className="mb-3">
      <div className="rc-label">Supporting documents</div>
      <div className="d-flex flex-wrap gap-2">
        {h.documents.map((d) => (
          <button key={d.id} type="button" className="btn btn-sm btn-rc-outline d-flex align-items-center gap-1" onClick={() => open(d)}>
            <FileText size={14} /> {d.label}
          </button>
        ))}
      </div>
      {error && <div className="small text-danger mt-1">{error}</div>}
    </div>
  )
}

export default function HouseholdDetail({ h }) {
  const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
  return (
    <>
      <div className="rc-detail-grid mb-3">
        <div><div className="rc-label">Reference no.</div>{h.reference_number ?? <span className="text-secondary">Not issued yet</span>}</div>
        <div><div className="rc-label">Status</div><StatusBadge status={h.status} /></div>
        <div><div className="rc-label">Priority</div><PriorityBadge level={h.priority_level} score={h.priority_score} /></div>
        <div><div className="rc-label">Purok</div>{h.purok}</div>
        <div><div className="rc-label">Address</div>{h.address || '—'}</div>
        <div><div className="rc-label">Mobile</div>{h.contact_number || '—'}</div>
        <div><div className="rc-label">Registration</div>{h.registration_type === 'walk_in' ? 'Walk-in' : 'Online (resident app)'}</div>
        <div><div className="rc-label">Submitted</div>{fmt(h.created_at)}</div>
        <div><div className="rc-label">Solo parent</div>{h.is_solo_parent ? 'Yes' : 'No'}</div>
      </div>
      {h.status === 'rejected' && h.rejection_reason && (
        <div className="alert alert-warning py-2 small">Rejected: {h.rejection_reason}</div>
      )}

      <Documents h={h} />

      <div className="table-responsive">
        <table className="rc-table">
          <thead><tr><th>Name</th><th>Relationship</th><th>Age</th><th>Sex</th><th>Tags</th></tr></thead>
          <tbody>
            {h.members.map((m) => (
              <tr key={m.id}>
                <td className="fw-semibold">{m.full_name}</td>
                <td>{m.relationship}</td>
                <td>{m.age}</td>
                <td>{m.sex}</td>
                <td>
                  {m.age >= 60 && <span className="rc-tag">Senior</span>}
                  {m.age <= 1 && <span className="rc-tag">Infant</span>}
                  {m.is_pwd && <span className="rc-tag">PWD</span>}
                  {m.is_pregnant && <span className="rc-tag">Pregnant</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
