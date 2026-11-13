import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, Minus, Plus, Search } from 'lucide-react'
import api, { errorMessage } from '../../api/client'
import useLiveTick from '../../components/useLiveTick'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import { PriorityBadge, StatusBadge } from '../../components/Badges'
import useSummary from './useSummary'

const TABS = [
  { key: 'pending', label: 'Waiting for review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled by resident' },
]
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
const age = (birthdate) => {
  const b = new Date(`${birthdate}T00:00`); const t = new Date()
  return t.getFullYear() - b.getFullYear() - (t < new Date(t.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0)
}

function Tags({ m }) {
  const a = age(m.birthdate)
  return (
    <>
      {a >= 60 && <span className="rc-tag">Senior</span>}
      {a <= 1 && <span className="rc-tag">Infant</span>}
      {m.is_pwd && <span className="rc-tag">PWD</span>}
      {m.is_pregnant && <span className="rc-tag">Pregnant</span>}
    </>
  )
}

/** What the request changes, compared with the household record as it is now. */
function Changes({ diff }) {
  return (
    <>
      {diff.fields.length > 0 && (
        <div className="mb-3">
          <div className="rc-label">Household details</div>
          <table className="rc-table rc-table-compact">
            <thead><tr><th>Field</th><th>Now</th><th /><th>Requested</th></tr></thead>
            <tbody>
              {diff.fields.map((c) => (
                <tr key={c.field}>
                  <td className="fw-semibold">{c.field}</td>
                  <td className="text-secondary">{c.before}</td>
                  <td><ArrowRight size={13} className="text-secondary" /></td>
                  <td className="fw-semibold">{c.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {diff.members_added.length > 0 && (
        <div className="mb-3">
          <div className="rc-label text-success d-flex align-items-center gap-1"><Plus size={13} /> Members to add</div>
          <ul className="list-unstyled mb-0 small">
            {diff.members_added.map((m) => (
              <li key={m.full_name + m.birthdate} className="py-1">
                <b>{m.full_name}</b> · {m.relationship} · {m.sex === 'F' ? 'Female' : 'Male'} · born {fmt(m.birthdate)} ({age(m.birthdate)} yrs) <Tags m={m} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.members_removed.length > 0 && (
        <div className="mb-3">
          <div className="rc-label text-danger d-flex align-items-center gap-1"><Minus size={13} /> Members to remove</div>
          <ul className="list-unstyled mb-0 small">
            {diff.members_removed.map((m) => (
              <li key={m.full_name + m.birthdate} className="py-1"><b>{m.full_name}</b> · {m.relationship} · born {fmt(m.birthdate)}</li>
            ))}
          </ul>
        </div>
      )}

      {diff.members_edited.length > 0 && (
        <div className="mb-3">
          <div className="rc-label">Members with corrected details</div>
          <table className="rc-table rc-table-compact">
            <thead><tr><th>Member</th><th>Field</th><th>Now</th><th /><th>Requested</th></tr></thead>
            <tbody>
              {diff.members_edited.flatMap((m) => m.changes.map((c, i) => (
                <tr key={m.name + c.field}>
                  <td className="fw-semibold">{i === 0 ? m.name : ''}</td>
                  <td>{c.field}</td>
                  <td className="text-secondary">{c.before}</td>
                  <td><ArrowRight size={13} className="text-secondary" /></td>
                  <td className="fw-semibold">{c.after}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default function UpdateRequests() {
  const [summary, reloadSummary] = useSummary()
  const [status, setStatus] = useState('pending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState(null)
  const [reviewing, setReviewing] = useState(null)
  const [rejectReason, setRejectReason] = useState(null) // null = not rejecting
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = () => api.get('/barangay/update-requests', { params: { status, page, search: search || undefined, per_page: 5 } })
    .then((r) => {
      // Approving or rejecting the last one on a page leaves it empty: go back one page
      if (r.data.data.length === 0 && page > 1) setPage(page - 1)
      else setList(r.data)
    })
  useEffect(() => { load() }, [status, page, search])
  const tick = useLiveTick()
  useEffect(() => { if (tick) load() }, [tick])

  const open = async (id) => {
    setError(''); setRejectReason(null)
    try {
      const r = await api.get(`/barangay/update-requests/${id}`)
      setReviewing(r.data)
    } catch (err) { setNotice(''); setError(errorMessage(err)) }
  }
  const close = () => { setReviewing(null); setRejectReason(null); setError('') }

  const act = async (action) => {
    setBusy(true); setError('')
    try {
      const r = await api.post(`/barangay/update-requests/${reviewing.id}/${action}`, action === 'reject' ? { reason: rejectReason } : {})
      setNotice(r.data.message)
      close(); load(); reloadSummary()
    } catch (err) {
      setError(errorMessage(err))
    } finally { setBusy(false) }
  }

  const h = reviewing?.household
  const proposed = reviewing?.proposed

  return (
    <>
      <PageHeader title="Household Update Requests"
                  subtitle={`Residents of Barangay ${summary?.barangay ?? ''} asking to change their household details or family members`} />

      {notice && (
        <div className="alert alert-success py-2 small d-flex align-items-center gap-2"><CheckCircle2 size={16} /> {notice}</div>
      )}
      {error && !reviewing && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="rc-tabs mb-3" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={status === t.key} className={status === t.key ? 'active' : ''}
                  onClick={() => { setStatus(t.key); setPage(1) }}>
            {t.label}{t.key === 'pending' && summary?.update_requests_pending ? ` (${summary.update_requests_pending})` : ''}
          </button>
        ))}
      </div>

      <section className="rc-card">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <p className="small text-secondary mb-0">
            {status === 'pending'
              ? 'Oldest first. Nothing on the household changes until you approve. The reference number and QR code stay the same.'
              : 'Most recent first.'}
          </p>
          <div className="position-relative" style={{ maxWidth: 260 }}>
            <Search size={14} className="position-absolute text-secondary" style={{ left: 10, top: 9 }} />
            <input className="form-control form-control-sm ps-4" placeholder="Search head or reference no." aria-label="Search"
                   value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>
        </div>
        <div className="table-responsive">
          <table className="rc-table">
            <thead>
              <tr>
                <th>Household head</th><th>Reference no.</th><th>Purok</th>
                {status === 'pending' ? <th>Changes</th> : <th>Reviewed</th>}
                <th>Resident’s reason</th><th>Submitted</th><th />
              </tr>
            </thead>
            <tbody>
              {list?.data.map((r) => (
                <tr key={r.id}>
                  <td className="fw-semibold">{r.household.household_head}</td>
                  <td>{r.household.reference_number}</td>
                  <td>{r.household.purok}</td>
                  {status === 'pending'
                    ? <td>{r.changes_count} change{r.changes_count === 1 ? '' : 's'}</td>
                    : <td className="muted">{status === 'cancelled' ? '—' : `${fmt(r.reviewed_at)}${r.reviewer ? ` · ${r.reviewer}` : ''}`}</td>}
                  <td className="text-truncate" style={{ maxWidth: 260 }} title={r.reason}>{r.reason || '—'}</td>
                  <td className="muted">{fmt(r.submitted_at)}</td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-rc-outline" onClick={() => open(r.id)}>{status === 'pending' ? 'Review' : 'View'}</button>
                  </td>
                </tr>
              ))}
              {list?.data.length === 0 && (
                <tr><td colSpan={7} className="text-center muted py-4">
                  {status === 'pending' ? 'No requests waiting. Requests from the resident app will appear here.' : 'No requests here.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination meta={list} onPage={setPage} />
      </section>

      {reviewing && (
        <Modal title={`Update request: ${h.household_head}`} size="lg" onClose={close}>
          <div className="rc-detail-grid mb-3">
            <div><div className="rc-label">Reference no.</div>{h.reference_number}</div>
            <div><div className="rc-label">Status</div><StatusBadge status={reviewing.status} /></div>
            <div><div className="rc-label">Current priority</div><PriorityBadge level={h.priority_level} score={h.priority_score} /></div>
            <div><div className="rc-label">Requested by</div>{reviewing.requester?.name ?? '—'}{reviewing.requester?.phone ? ` · ${reviewing.requester.phone}` : ''}</div>
            <div><div className="rc-label">Submitted</div>{fmt(reviewing.submitted_at)}</div>
            {reviewing.reviewed_at && <div><div className="rc-label">Reviewed</div>{fmt(reviewing.reviewed_at)}{reviewing.reviewer ? ` · ${reviewing.reviewer}` : ''}</div>}
          </div>

          <div className="alert alert-light border py-2 small mb-3">
            <b>Resident’s reason:</b> {reviewing.reason || '—'}
          </div>
          {reviewing.status === 'rejected' && reviewing.review_note && (
            <div className="alert alert-warning py-2 small">Rejected: {reviewing.review_note}</div>
          )}

          {reviewing.diff && (reviewing.diff.count > 0
            ? <Changes diff={reviewing.diff} />
            : <p className="small text-secondary">The household already matches this request.</p>)}

          {reviewing.status === 'pending' && (
            <p className="small text-secondary">
              Verify the changes with the resident (e.g. a birth certificate for a new baby) before approving.
              Approving recomputes the priority score.
            </p>
          )}

          <details className="mb-2" open={reviewing.status !== 'pending'}>
            <summary className="small fw-semibold mb-2" style={{ cursor: 'pointer' }}>
              {reviewing.status === 'approved' ? 'Details as approved' : 'Full member list as requested'} ({proposed.members.length})
            </summary>
            <div className="small mb-2">
              Purok <b>{proposed.purok}</b>{proposed.address ? <> · {proposed.address}</> : null} · Solo parent <b>{proposed.is_solo_parent ? 'Yes' : 'No'}</b>
            </div>
            <div className="table-responsive">
              <table className="rc-table rc-table-compact">
                <thead><tr><th>Name</th><th>Relationship</th><th>Age</th><th>Sex</th><th>Tags</th></tr></thead>
                <tbody>
                  {proposed.members.map((m) => (
                    <tr key={m.full_name + m.birthdate}>
                      <td className="fw-semibold">{m.full_name}</td><td>{m.relationship}</td><td>{age(m.birthdate)}</td><td>{m.sex}</td>
                      <td><Tags m={m} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {error && <div className="alert alert-danger py-2 small mt-3">{error}</div>}

          {reviewing.status === 'pending' && (rejectReason === null ? (
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button className="btn btn-outline-danger" onClick={() => setRejectReason('')}>Reject</button>
              <button className="btn btn-rc" disabled={busy} onClick={() => act('approve')}>
                {busy ? 'Applying…' : 'Approve & Update Household'}
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <label className="rc-label" htmlFor="ur-reason">Reason for rejection (shown to the resident)</label>
              <textarea id="ur-reason" className="form-control mb-2" rows={2} autoFocus maxLength={255}
                        placeholder="e.g. Please bring the baby's birth certificate to the barangay hall"
                        value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              <div className="d-flex justify-content-end gap-2">
                <button className="btn btn-light" onClick={() => setRejectReason(null)}>Back</button>
                <button className="btn btn-danger" disabled={busy || !rejectReason.trim()} onClick={() => act('reject')}>
                  {busy ? 'Rejecting…' : 'Reject Request'}
                </button>
              </div>
            </div>
          ))}
        </Modal>
      )}
    </>
  )
}
