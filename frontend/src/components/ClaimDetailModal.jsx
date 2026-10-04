import { useEffect, useState } from 'react'
import { CalendarDays, MapPin, QrCode, Hash, WifiOff } from 'lucide-react'
import api, { errorMessage } from '../api/client'
import Modal from './Modal'
import { PriorityBadge, StatusBadge } from './Badges'
import { fmtDateTime } from './format'

/**
 * Full details of one claim: who received it, what and how much, when,
 * how it was verified, and who released it.
 * url = '/admin/claims/12' (LGU) or a barangay claim URL.
 */
export default function ClaimDetailModal({ url, onClose }) {
  const [c, setC] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(url).then((r) => setC(r.data)).catch((err) => setError(errorMessage(err)))
  }, [url])

  const h = c?.household

  return (
    <Modal title="Claim details" size="lg" onClose={onClose}>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {!c ? (!error && <p className="text-secondary">Loading…</p>) : (
        <>
          <div className="rc-detail-grid mb-3">
            <div><div className="rc-label">Received</div><span className="fw-bold">{c.quantity_label}</span>{c.item.type === 'goods' && <> of {c.item.name}</>}</div>
            {c.item.type === 'cash' && <div><div className="rc-label">From fund</div>{c.item.name}</div>}
            <div><div className="rc-label">Claimed on</div>{fmtDateTime(c.distributed_at)}</div>
            <div>
              <div className="rc-label">Verified by</div>
              {c.verification_method === 'qr'
                ? <><QrCode size={13} className="me-1" />QR scan</>
                : <><Hash size={13} className="me-1" />Reference number</>}
            </div>
            <div><div className="rc-label">Released by</div>{c.released_by ?? '—'}</div>
            {c.synced_from_offline && (
              <div>
                <div className="rc-label">Recorded offline</div>
                <WifiOff size={13} className="me-1" />Synced {fmtDateTime(c.recorded_at)}
              </div>
            )}
          </div>

          {c.event && (
            <div className="rc-advisory mb-3 small">
              <div className="flex-grow-1">
                <div className="fw-semibold">{c.event.name} <StatusBadge status={c.event.status} /></div>
                {c.distribution_day && (
                  <div className="text-secondary mt-1">
                    <CalendarDays size={12} className="me-1" />{fmtDateTime(c.distribution_day.scheduled_at)}
                    <MapPin size={12} className="ms-3 me-1" />{c.distribution_day.venue ?? '—'}
                  </div>
                )}
              </div>
            </div>
          )}

          <h3 className="rc-card-title">Household</h3>
          <div className="rc-detail-grid mb-3">
            <div><div className="rc-label">Reference no.</div>{h.reference_number}</div>
            <div><div className="rc-label">Household head</div><span className="fw-semibold">{h.household_head}</span></div>
            <div><div className="rc-label">Priority</div><PriorityBadge level={h.priority_level} score={h.priority_score} /></div>
            <div><div className="rc-label">Barangay / purok</div>{h.barangay}, {h.purok}</div>
            <div><div className="rc-label">Address</div>{h.address || '—'}</div>
            <div><div className="rc-label">Contact</div>{h.contact_number || '—'}</div>
            <div><div className="rc-label">Registered through</div>{h.registration_type === 'walk_in' ? 'Walk-in (barangay)' : 'Resident app'}</div>
          </div>

          <div className="table-responsive">
            <table className="rc-table">
              <thead><tr><th>Member</th><th>Relationship</th><th>Age</th><th>Sex</th><th /></tr></thead>
              <tbody>
                {h.members.map((m, i) => (
                  <tr key={i}>
                    <td className="fw-semibold">{m.full_name}</td>
                    <td>{m.relationship}</td>
                    <td>{m.age}</td>
                    <td>{m.sex}</td>
                    <td>
                      <span className="rc-member-flags">
                        {m.age >= 60 && <span>Senior</span>}
                        {m.is_pwd && <span>PWD</span>}
                        {m.is_pregnant && <span>Pregnant</span>}
                        {m.age <= 1 && <span>Infant</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  )
}
