import { useEffect, useState } from 'react'
import { Package, Wallet } from 'lucide-react'
import api from '../api/client'
import ClaimDetailModal from './ClaimDetailModal'
import { fmtDateTime, peso } from './format'

/** Every aid one household received: when, which event, goods or cash, and how much. */
export default function ClaimHistory({ householdId }) {
  const [d, setD] = useState(null)
  const [openId, setOpenId] = useState(null)

  useEffect(() => { api.get(`/barangay/households/${householdId}/claims`).then((r) => setD(r.data)) }, [householdId])
  if (!d) return <p className="small text-secondary">Loading claim history…</p>
  const s = d.summary

  return (
    <>
      <h3 className="rc-card-title mt-3">Claim history</h3>
      <div className="row g-2 mb-2">
        <div className="col-6 col-md-3"><div className="rc-stat h-100">
          <div className="rc-stat-label">Times claimed</div><div className="fw-bold">{s.claims}</div>
        </div></div>
        <div className="col-6 col-md-3"><div className="rc-stat h-100">
          <div className="rc-stat-label">Events</div><div className="fw-bold">{s.events}</div>
        </div></div>
        <div className="col-6 col-md-3"><div className="rc-stat h-100">
          <div className="rc-stat-label">Relief goods</div><div className="fw-bold">{s.goods_units.toLocaleString()} unit{s.goods_units === 1 ? '' : 's'}</div>
        </div></div>
        <div className="col-6 col-md-3"><div className="rc-stat h-100">
          <div className="rc-stat-label">Cash aid</div><div className="fw-bold">{peso(s.cash_total)}</div>
        </div></div>
      </div>

      <div className="table-responsive">
        <table className="rc-table">
          <thead><tr><th>Claimed on</th><th>Event</th><th>Type</th><th>Received</th><th>Verified by</th></tr></thead>
          <tbody>
            {d.claims.map((c) => (
              <tr key={c.id} className="rc-row-click" tabIndex={0} onClick={() => setOpenId(c.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(c.id) }} title="See claim details">
                <td className="text-nowrap">{fmtDateTime(c.distributed_at)}</td>
                <td>
                  <div className="fw-semibold">{c.event}</div>
                  {c.eligibility && c.eligibility !== 'All households' && <div className="small text-secondary">For {c.eligibility.toLowerCase()}</div>}
                </td>
                <td className="text-nowrap">
                  {c.type === 'Cash aid' ? <Wallet size={13} className="me-1 text-success" /> : <Package size={13} className="me-1 text-success" />}
                  {c.type}
                </td>
                <td className="text-nowrap">{c.quantity_label}<div className="small text-secondary">{c.item}</div></td>
                <td>{c.verification_method === 'qr' ? 'QR scan' : 'Reference no.'}{c.synced_from_offline && <span className="rc-tag ms-1">Offline</span>}</td>
              </tr>
            ))}
            {d.claims.length === 0 && <tr><td colSpan={5} className="text-center muted py-3">This household hasn't claimed any aid yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {openId && <ClaimDetailModal url={`/barangay/claims/${openId}`} onClose={() => setOpenId(null)} />}
    </>
  )
}
