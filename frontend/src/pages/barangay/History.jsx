import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, CalendarDays, MapPin, Package, Wallet, Users } from 'lucide-react'
import api, { errorMessage } from '../../api/client'
import PageHeader from '../../components/PageHeader'
import ClaimDetailModal from '../../components/ClaimDetailModal'
import { PriorityBadge, StatusBadge } from '../../components/Badges'
import { fmtDate, fmtDateTime, fmtTime } from '../../components/format'
import useSummary from './useSummary'

/**
 * Distribution History: Event → Day 1, Day 2… (the dates claims were made) → households that claimed.
 */
export default function History() {
  const [summary] = useSummary()
  const [events, setEvents] = useState(null)
  const [expanded, setExpanded] = useState({})       // event_id -> open?
  const [selected, setSelected] = useState(null)     // { event, day | null }
  const [claims, setClaims] = useState(null)
  const [openClaim, setOpenClaim] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/barangay/history').then((r) => {
      setEvents(r.data)
      // Open the most recent event that has claims
      const first = r.data.find((e) => e.days.length)
      if (first) setExpanded({ [first.event_id]: true })
    }).catch((err) => setError(errorMessage(err)))
  }, [])

  useEffect(() => {
    if (!selected) return
    setClaims(null)
    api.get(`/barangay/history/${selected.event.event_id}/claims`, { params: { date: selected.day?.date } })
      .then((r) => setClaims(r.data)).catch((err) => setError(errorMessage(err)))
  }, [selected])

  const toggle = (id) => setExpanded((x) => ({ ...x, [id]: !x[id] }))
  const isSelected = (e, day) => selected?.event.event_id === e.event_id && (selected.day?.date ?? null) === (day?.date ?? null)

  return (
    <>
      <PageHeader title="Distribution History"
                  subtitle={`Every distribution in Barangay ${summary?.barangay ?? ''}, day by day, and the households that claimed`} />
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="row g-3">
        <div className="col-lg-5">
          {events?.length === 0 && <section className="rc-card text-secondary small">No distribution events have included your barangay yet.</section>}
          {events?.map((e) => (
            <div className="rc-tree-event" key={e.event_id}>
              <button className="rc-tree-head" onClick={() => toggle(e.event_id)} aria-expanded={!!expanded[e.event_id]}>
                {expanded[e.event_id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="flex-grow-1">
                  <span className="fw-semibold d-block">{e.name}</span>
                  <span className="small text-secondary d-flex flex-wrap align-items-center gap-2">
                    <span>{e.type === 'Cash aid' ? <Wallet size={12} /> : <Package size={12} />} {e.type}</span>
                    <span>{e.amount_label}</span>
                  </span>
                  {e.eligibility_label !== 'All households' && <span className="rc-tag mt-1 d-inline-block">For: {e.eligibility_label}</span>}
                </span>
                <span className="text-end small">
                  <StatusBadge status={e.event_status === 'closed' && e.status !== 'closed' ? 'closed' : e.status} />
                  <span className="d-block text-secondary mt-1">{e.claimed} / {e.quota} claimed</span>
                </span>
              </button>

              {expanded[e.event_id] && (
                <div className="rc-tree-days">
                  {e.scheduled_at && (
                    <div className="small text-secondary">
                      <CalendarDays size={12} className="me-1" />Scheduled {fmtDateTime(e.scheduled_at)}
                      {e.venue && <><MapPin size={12} className="ms-2 me-1" />{e.venue}</>}
                    </div>
                  )}
                  {e.days.length === 0 ? (
                    <div className="small text-secondary mt-2">No claims yet.</div>
                  ) : (
                    <>
                      {e.days.map((day) => (
                        <button key={day.date} className={`rc-tree-day ${isSelected(e, day) ? 'active' : ''}`}
                                onClick={() => setSelected({ event: e, day })}>
                          <span className="rc-day-num">Day {day.day_number}</span>
                          <span className="flex-grow-1">{fmtDate(day.date)}</span>
                          <span className="small text-secondary text-nowrap"><Users size={12} className="me-1" />{day.households} · {day.quantity_label}</span>
                        </button>
                      ))}
                      {e.days.length > 1 && (
                        <button className={`rc-tree-day ${isSelected(e, null) ? 'active' : ''}`} onClick={() => setSelected({ event: e, day: null })}>
                          <span className="rc-day-num">All</span>
                          <span className="flex-grow-1">All {e.days.length} days</span>
                          <span className="small text-secondary"><Users size={12} className="me-1" />{e.claimed}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="col-lg-7">
          <section className="rc-card">
            {!selected ? (
              <p className="small text-secondary mb-0">Open an event and choose a day to see the households that claimed.</p>
            ) : (
              <>
                <h2 className="rc-card-title mb-0">{selected.event.name}</h2>
                <p className="small text-secondary">
                  {selected.day ? `Day ${selected.day.day_number}, ${fmtDate(selected.day.date)}` : `All ${selected.event.days.length} days`}
                  {claims && ` · ${claims.length} household${claims.length === 1 ? '' : 's'} claimed`}. Click a household to see the claim.
                </p>
                <div className="table-responsive">
                  <table className="rc-table">
                    <thead><tr><th>{selected.day ? 'Time' : 'Claimed on'}</th><th>Household</th><th>Purok</th><th>Priority</th><th>Received</th><th>Released by</th></tr></thead>
                    <tbody>
                      {claims?.map((c) => (
                        <tr key={c.id} className="rc-row-click" tabIndex={0} onClick={() => setOpenClaim(c.id)}
                            onKeyDown={(ev) => { if (ev.key === 'Enter') setOpenClaim(c.id) }}>
                          <td className="text-nowrap">{selected.day ? fmtTime(c.distributed_at) : fmtDateTime(c.distributed_at)}</td>
                          <td><div className="fw-semibold">{c.household_head}</div><div className="small text-secondary">{c.reference_number}</div></td>
                          <td>{c.purok}</td>
                          <td><PriorityBadge level={c.priority_level} score={c.priority_score} /></td>
                          <td className="text-nowrap">{c.quantity_label}</td>
                          <td className="muted">{c.released_by}</td>
                        </tr>
                      ))}
                      {claims === null && <tr><td colSpan={6} className="text-center muted py-3">Loading…</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {openClaim && <ClaimDetailModal url={`/barangay/claims/${openClaim}`} onClose={() => setOpenClaim(null)} />}
    </>
  )
}
