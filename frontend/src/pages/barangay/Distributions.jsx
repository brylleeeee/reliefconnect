import { useEffect, useState } from 'react'
import { Search, CalendarDays, MapPin, CheckCircle2, Clock, Play, Square, XCircle, Megaphone } from 'lucide-react'
import api, { errorMessage } from '../../api/client'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import AnnounceModal from '../../components/AnnounceModal'
import { PriorityBadge, StatusBadge } from '../../components/Badges'
import { fmtDate, fmtDateTime, fmtTime, qtyUnit, toLocalInput } from '../../components/format'
import useSummary from './useSummary'

export default function Distributions() {
  const [summary] = useSummary()
  const [rows, setRows] = useState(null)       // this barangay's part of each event
  const [eventId, setEventId] = useState('')
  const [filters, setFilters] = useState({ claim: 'unclaimed', purok: '', priority: '', search: '' })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [scheduling, setScheduling] = useState(null) // { scheduled_at, venue }
  const [announcing, setAnnouncing] = useState(null) // prefilled announcement for residents
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadRows = () => api.get('/barangay/distributions')
    .then((r) => {
      setRows(r.data)
      setEventId((cur) => cur || (r.data.length ? String(r.data[0].event_id) : ''))
    })
    .catch((err) => setError(errorMessage(err)))
  useEffect(() => { loadRows() }, [])

  const loadHouseholds = () => {
    if (!eventId) return
    const params = Object.fromEntries(Object.entries({ ...filters, page }).filter(([, v]) => v))
    api.get(`/barangay/distributions/${eventId}/households`, { params })
      .then((r) => setData(r.data))
      .catch((err) => setError(errorMessage(err)))
  }
  useEffect(() => { loadHouseholds() }, [eventId, filters, page])

  const row = rows?.find((r) => String(r.event_id) === eventId)
  const ongoing = row?.status === 'ongoing' && row?.event_status === 'open'

  // While distributing, refresh claims every 15 seconds
  useEffect(() => {
    if (!ongoing) return
    const t = setInterval(() => { loadHouseholds(); loadRows() }, 15000)
    return () => clearInterval(t)
  }, [ongoing, eventId, filters, page])

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setFilters((f) => ({ ...f, search })) }, 350)
    return () => clearTimeout(t)
  }, [search])

  const setFilter = (k, v) => { setPage(1); setFilters((f) => ({ ...f, [k]: v })) }

  const run = async (fn, message) => {
    setBusy(true); setError(''); setNotice('')
    try {
      const r = await fn()
      setNotice(message); setScheduling(null)
      loadRows(); loadHouseholds()
      return r
    } catch (err) {
      setError(errorMessage(err))
    } finally { setBusy(false) }
  }

  /** Draft a message to residents from the schedule; the barangay can edit it before publishing. */
  const draftAnnouncement = (r) => ({
    title: `Relief distribution: ${r.name}`,
    description: [
      `Distribution on ${fmtDateTime(r.scheduled_at)} at ${r.venue}.`,
      `${qtyUnit(r.quantity_per_household, r.item.unit)} of ${r.item.name} per household.`,
      'Bring your ReliefConnect QR code or reference number.',
      r.notes,
    ].filter(Boolean).join(' '),
    distribution_event_id: r.event_id,
  })

  const start = () => {
    if (!window.confirm(`Start the distribution for "${row.name}" now? Distribution personnel will be able to record claims.`)) return
    run(() => api.post(`/barangay/distributions/${eventId}/start`), 'Distribution started. Claims can now be recorded.')
  }
  const close = () => {
    if (!window.confirm(`Close the distribution for "${row.name}"? No more claims can be recorded for your barangay.`)) return
    run(() => api.post(`/barangay/distributions/${eventId}/close`), 'Distribution closed.')
  }
  const saveSchedule = async (e) => {
    e.preventDefault()
    const r = await run(() => api.put(`/barangay/distributions/${eventId}/schedule`, scheduling),
      'Distribution day saved. Announce it so your residents know when and where to claim.')
    if (r) setAnnouncing(draftAnnouncement(r.data))
  }

  const c = data?.counts
  // Not-yet-claimed households are "Pending" while the distribution can still happen, "Unclaimed" after it closes
  const phaseLabel = data?.claim_phase === 'unclaimed' ? 'Unclaimed' : 'Pending'

  return (
    <>
      <PageHeader title="Distributions"
                  subtitle={`Schedule and run Barangay ${summary?.barangay ?? ''}'s distribution day, and follow up on households that haven't claimed`} />

      {error && !scheduling && <div className="alert alert-danger py-2 small">{error}</div>}
      {notice && <div className="alert alert-success py-2 small">{notice}</div>}

      {rows?.length === 0 && (
        <section className="rc-card text-center text-secondary py-5">
          No distribution events include your barangay yet. Events created by the LGU will appear here.
        </section>
      )}

      {row && (
        <>
          <section className="rc-card mb-3">
            <div className="row g-3">
              <div className="col-lg-5">
                <label className="rc-label" htmlFor="event-pick">Distribution event</label>
                <select id="event-pick" className="form-select mb-2" value={eventId}
                        onChange={(e) => { setPage(1); setData(null); setNotice(''); setEventId(e.target.value) }}>
                  {rows.map((r) => <option key={r.event_id} value={r.event_id}>{r.name}</option>)}
                </select>
                <div className="small">
                  <div className="fw-semibold">{qtyUnit(row.quantity_per_household, row.item.unit)} of {row.item.name} per household</div>
                  {row.distribute_by && <div className="text-secondary">LGU deadline: distribute by {fmtDate(row.distribute_by)}</div>}
                  {row.notes && <div className="text-secondary mt-1">{row.notes}</div>}
                </div>
              </div>

              <div className="col-lg-7">
                <div className="rc-label">Your distribution day</div>
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                  <div className="small">
                    <div className="mb-1"><StatusBadge status={row.event_status === 'closed' && row.status !== 'closed' ? 'closed' : row.status} /></div>
                    {row.scheduled_at ? (
                      <>
                        <div><CalendarDays size={13} className="me-1" />{fmtDateTime(row.scheduled_at)}</div>
                        <div><MapPin size={13} className="me-1" />{row.venue}</div>
                      </>
                    ) : <div className="text-secondary">Set a date and venue so residents know when and where to claim.</div>}
                    {row.started_at && <div className="text-secondary mt-1">Started {fmtDateTime(row.started_at)}</div>}
                    {row.closed_at && <div className="text-secondary">Closed {fmtDateTime(row.closed_at)}</div>}
                  </div>

                  {row.event_status === 'closed' ? (
                    <span className="small text-secondary">The LGU has closed this event.</span>
                  ) : (
                    <div className="d-flex flex-wrap gap-2">
                      {['unscheduled', 'scheduled'].includes(row.status) && (
                        <button className="btn btn-sm btn-rc-outline" disabled={busy}
                                onClick={() => { setError(''); setScheduling({ scheduled_at: toLocalInput(row.scheduled_at), venue: row.venue ?? '' }) }}>
                          {row.status === 'unscheduled' ? 'Set date and venue' : 'Change schedule'}
                        </button>
                      )}
                      {row.status === 'scheduled' && (
                        <button className="btn btn-sm btn-rc" disabled={busy} onClick={start}>
                          <Play size={13} className="me-1" />Start distribution
                        </button>
                      )}
                      {['scheduled', 'ongoing'].includes(row.status) && (
                        <button className="btn btn-sm btn-rc-outline" disabled={busy} onClick={() => setAnnouncing(draftAnnouncement(row))}>
                          <Megaphone size={13} className="me-1" />Announce to residents
                        </button>
                      )}
                      {row.status === 'ongoing' && (
                        <button className="btn btn-sm btn-outline-danger" disabled={busy} onClick={close}>
                          <Square size={12} className="me-1" />Close distribution
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="row g-3 mb-3">
            <div className="col-md-3"><div className="rc-stat">
              <div className="rc-stat-label">Quota (households)</div>
              <div className="rc-stat-value">{c?.quota ?? '—'}</div>
            </div></div>
            <div className="col-md-3"><div className="rc-stat green">
              <div className="rc-stat-label">Claimed</div>
              <div className="rc-stat-value green">{c?.claimed ?? '—'}</div>
            </div></div>
            <div className="col-md-3"><div className="rc-stat blue">
              <div className="rc-stat-label">Pending</div>
              <div className="rc-stat-value blue">{c?.pending ?? '—'}</div>
            </div></div>
            <div className="col-md-3"><div className="rc-stat">
              <div className="rc-stat-label">Unclaimed</div>
              <div className={`rc-stat-value ${c?.unclaimed ? 'danger' : ''}`}>{c?.unclaimed ?? '—'}</div>
            </div></div>
          </div>
          <p className="small text-secondary">
            <strong>Pending</strong>: quota not yet claimed while your distribution can still happen.{' '}
            <strong>Unclaimed</strong>: quota left over after the distribution closed.
            {c && c.quota < c.approved_households && ` The LGU's quota covers ${c.quota} of your ${c.approved_households} approved households, so not every household can claim in this event.`}
          </p>

          <section className="rc-card mb-3">
            <h2 className="rc-card-title">By purok</h2>
            <div className="table-responsive">
              <table className="rc-table">
                <thead><tr><th>Purok</th><th>Approved households</th><th>Claimed</th><th>{phaseLabel}</th></tr></thead>
                <tbody>
                  {data?.by_purok.map((r) => (
                    <tr key={r.purok}>
                      <td className="fw-semibold">{r.purok}</td>
                      <td>{r.households}</td>
                      <td>{r.claimed}</td>
                      <td className={r.not_claimed && data.claim_phase === 'unclaimed' ? 'text-danger fw-semibold' : ''}>{r.not_claimed}</td>
                    </tr>
                  ))}
                  {data && (
                    <tr className="fw-bold">
                      <td>Total</td>
                      <td>{c.approved_households}</td>
                      <td>{c.claimed}</td>
                      <td>{data.by_purok.reduce((n, r) => n + r.not_claimed, 0)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rc-card">
            <h2 className="rc-card-title">Households</h2>
            <div className="row g-2 mb-3">
              <div className="col-md-4">
                <div className="rc-search">
                  <Search size={15} />
                  <input className="form-control" placeholder="Search by name or reference no."
                         aria-label="Search households" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              <div className="col-md-3">
                <select className="form-select" aria-label="Claim status" value={filters.claim}
                        onChange={(e) => setFilter('claim', e.target.value)}>
                  <option value="unclaimed">{phaseLabel}</option>
                  <option value="claimed">Claimed</option>
                  <option value="">All households</option>
                </select>
              </div>
              <div className="col-md-2">
                <select className="form-select" aria-label="Purok" value={filters.purok} onChange={(e) => setFilter('purok', e.target.value)}>
                  <option value="">All puroks</option>
                  {summary?.puroks.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <select className="form-select" aria-label="Priority" value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}>
                  <option value="">All priority levels</option>
                  <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <table className="rc-table">
                <thead>
                  <tr><th>Reference no.</th><th>Household head</th><th>Purok</th><th>Members</th><th>Priority</th><th>Contact</th><th>Claim status</th></tr>
                </thead>
                <tbody>
                  {data?.households.data.map((h) => (
                    <tr key={h.id}>
                      <td>{h.reference_number}</td>
                      <td className="fw-semibold">{h.household_head}</td>
                      <td>{h.purok}</td>
                      <td>{h.members_count}</td>
                      <td><PriorityBadge level={h.priority_level} score={h.priority_score} /></td>
                      <td className="muted">{h.contact_number || '—'}</td>
                      <td>
                        {h.claimed_at
                          ? <span className="rc-claim claimed"><CheckCircle2 size={13} /> Claimed {fmtTime(h.claimed_at)}</span>
                          : data.claim_phase === 'unclaimed'
                            ? <span className="rc-claim unclaimed"><XCircle size={13} /> Unclaimed</span>
                            : <span className="rc-claim pending"><Clock size={13} /> Pending</span>}
                      </td>
                    </tr>
                  ))}
                  {data?.households.data.length === 0 && (
                    <tr><td colSpan={7} className="text-center muted py-4">
                      {filters.claim === 'unclaimed' ? 'Every approved household matching these filters has claimed.' : 'No households match these filters.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination meta={data?.households} onPage={setPage} />
          </section>
        </>
      )}

      {announcing && (
        <AnnounceModal initial={announcing} onClose={() => setAnnouncing(null)}
                       note="Residents of your barangay will see this in the ReliefConnect app. Edit it as needed before publishing."
                       onSaved={() => { setAnnouncing(null); setNotice('Announced to your residents.') }} />
      )}

      {scheduling && (
        <Modal title="Distribution day" onClose={() => { setScheduling(null); setError('') }}>
          <form onSubmit={saveSchedule}>
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            <p className="small text-secondary">
              {row.name}{row.distribute_by && `. The LGU asked barangays to distribute by ${fmtDate(row.distribute_by)}`}.
              You can change this until you start the distribution.
            </p>
            <label className="rc-label" htmlFor="sch-date">Date and time</label>
            <input id="sch-date" type="datetime-local" className="form-control mb-3" required
                   min={toLocalInput(new Date()).slice(0, 10) + 'T00:00'}
                   max={row.distribute_by ? `${row.distribute_by}T23:59` : undefined}
                   value={scheduling.scheduled_at} onChange={(e) => setScheduling({ ...scheduling, scheduled_at: e.target.value })} />
            <label className="rc-label" htmlFor="sch-venue">Venue</label>
            <input id="sch-venue" className="form-control mb-4" required maxLength={255} placeholder="e.g. Barangay Hall covered court"
                   value={scheduling.venue} onChange={(e) => setScheduling({ ...scheduling, venue: e.target.value })} />
            <button className="btn btn-rc w-100" disabled={busy}>{busy ? 'Saving…' : 'Save Distribution Day'}</button>
          </form>
        </Modal>
      )}
    </>
  )
}
