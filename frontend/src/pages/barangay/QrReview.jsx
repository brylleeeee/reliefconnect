import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import api, { errorMessage } from '../../api/client'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import HouseholdDetail from '../../components/HouseholdDetail'
import { PriorityBadge } from '../../components/Badges'
import useSummary from './useSummary'

export default function QrReview() {
  const [summary, reloadSummary] = useSummary()
  const [page, setPage] = useState(1)
  const [list, setList] = useState(null)
  const [reviewing, setReviewing] = useState(null) // full household
  const [rejectReason, setRejectReason] = useState(null) // null = not rejecting
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = () => api.get('/barangay/households', { params: { status: 'pending', sort: 'priority', page } })
    .then((r) => setList(r.data))
  useEffect(() => { load() }, [page])

  const open = async (id) => {
    setError(''); setRejectReason(null)
    const r = await api.get(`/barangay/households/${id}`)
    setReviewing(r.data)
  }
  const close = () => { setReviewing(null); setRejectReason(null); setError('') }

  const act = async (action) => {
    setBusy(true); setError('')
    try {
      const r = await api.post(`/barangay/households/${reviewing.id}/${action}`,
        action === 'reject' ? { reason: rejectReason } : {})
      setNotice(action === 'approve'
        ? `Approved ${r.data.household_head}. Reference no. ${r.data.reference_number} issued.`
        : `Rejected registration of ${r.data.household_head}.`)
      close(); load(); reloadSummary()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="QR Issuance Review"
                  subtitle={`Verify household registrations for Barangay ${summary?.barangay ?? ''} before issuing a QR code and reference number`} />

      <div className="row g-3 mb-3">
        <div className="col-md-4"><div className="rc-stat blue">
          <div className="rc-stat-label">Pending QR approvals</div>
          <div className="rc-stat-value blue">{summary?.pending ?? '—'}</div>
        </div></div>
        <div className="col-md-4"><div className="rc-stat green">
          <div className="rc-stat-label">Approved households</div>
          <div className="rc-stat-value green">{summary?.approved ?? '—'}</div>
        </div></div>
        <div className="col-md-4"><div className="rc-stat">
          <div className="rc-stat-label">High priority households</div>
          <div className="rc-stat-value danger">{summary?.high_priority ?? '—'}</div>
        </div></div>
      </div>

      {notice && (
        <div className="alert alert-success py-2 small d-flex align-items-center gap-2">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <section className="rc-card">
        <h2 className="rc-card-title mb-1">Registrations awaiting review</h2>
        <p className="small text-secondary">Sorted by priority, then by date submitted, so the most vulnerable households are reviewed first.</p>
        <div className="table-responsive">
          <table className="rc-table">
            <thead>
              <tr><th>Household head</th><th>Purok</th><th>Members</th><th>Priority</th><th>Submitted</th><th>Source</th><th /></tr>
            </thead>
            <tbody>
              {list?.data.map((h) => (
                <tr key={h.id}>
                  <td className="fw-semibold">{h.household_head}</td>
                  <td>{h.purok}</td>
                  <td>{h.members_count}</td>
                  <td><PriorityBadge level={h.priority_level} score={h.priority_score} /></td>
                  <td className="muted">{new Date(h.created_at).toLocaleDateString('en-PH')}</td>
                  <td className="muted">{h.registration_type === 'walk_in' ? 'Walk-in' : 'Resident app'}</td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-rc-outline" onClick={() => open(h.id)}>Review</button>
                  </td>
                </tr>
              ))}
              {list?.data.length === 0 && (
                <tr><td colSpan={7} className="text-center muted py-4">No registrations waiting. New ones from the resident app will appear here.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination meta={list} onPage={setPage} />
      </section>

      {reviewing && (
        <Modal title={`Review: ${reviewing.household_head}`} size="lg" onClose={close}>
          <HouseholdDetail h={reviewing} />
          {error && <div className="alert alert-danger py-2 small mt-3">{error}</div>}

          {rejectReason === null ? (
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button className="btn btn-outline-danger" onClick={() => setRejectReason('')}>Reject</button>
              <button className="btn btn-rc" disabled={busy} onClick={() => act('approve')}>
                {busy ? 'Approving…' : 'Approve & Issue QR'}
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <label className="rc-label" htmlFor="reason">Reason for rejection (shown to the resident)</label>
              <textarea id="reason" className="form-control mb-2" rows={2} autoFocus maxLength={255}
                        placeholder="e.g. Not a resident of this barangay; proof of residency needed"
                        value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              <div className="d-flex justify-content-end gap-2">
                <button className="btn btn-light" onClick={() => setRejectReason(null)}>Back</button>
                <button className="btn btn-danger" disabled={busy || !rejectReason.trim()} onClick={() => act('reject')}>
                  {busy ? 'Rejecting…' : 'Reject Registration'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
