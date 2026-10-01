import { useEffect, useState } from 'react'
import { Search, CalendarDays, MapPin, CheckCircle2, Clock } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { PriorityBadge, StatusBadge } from '../../components/Badges'
import Progress from '../../components/Progress'
import useSummary from './useSummary'

const fmtDate = (d) => new Date(d).toLocaleString('en-PH', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
})
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

export default function EventClaims() {
  const [summary] = useSummary()
  const [events, setEvents] = useState(null)
  const [eventId, setEventId] = useState('')
  const [filters, setFilters] = useState({ claim: 'unclaimed', purok: '', priority: '', search: '' })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)

  // Ongoing events come first, so the default selection is the one happening now
  useEffect(() => {
    api.get('/barangay/events').then((r) => {
      setEvents(r.data)
      if (r.data.length) setEventId(String(r.data[0].id))
    })
  }, [])

  const load = () => {
    if (!eventId) return
    const params = Object.fromEntries(Object.entries({ ...filters, page }).filter(([, v]) => v))
    api.get(`/barangay/events/${eventId}/households`, { params }).then((r) => setData(r.data))
  }
  useEffect(() => { load() }, [eventId, filters, page])

  // Refresh every 15 seconds while the event is ongoing
  useEffect(() => {
    if (data?.event.status !== 'ongoing') return
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [data?.event.status, eventId, filters, page])

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setFilters((f) => ({ ...f, search })) }, 350)
    return () => clearTimeout(t)
  }, [search])

  const setFilter = (k, v) => { setPage(1); setFilters((f) => ({ ...f, [k]: v })) }
  const selected = events?.find((e) => String(e.id) === eventId)
  const c = data?.counts

  return (
    <>
      <PageHeader title="Event Claims"
                  subtitle={`Who in Barangay ${summary?.barangay ?? ''} has and hasn't claimed during a distribution event`} />

      {events?.length === 0 && (
        <section className="rc-card text-center text-secondary py-5">
          No distribution events include your barangay yet. Events created by the LGU will appear here.
        </section>
      )}

      {selected && (
        <>
          <section className="rc-card mb-3">
            <div className="row g-3 align-items-center">
              <div className="col-md-5">
                <label className="rc-label" htmlFor="event-pick">Distribution event</label>
                <select id="event-pick" className="form-select" value={eventId}
                        onChange={(e) => { setPage(1); setData(null); setEventId(e.target.value) }}>
                  {events.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.status})</option>)}
                </select>
              </div>
              <div className="col-md-7 small">
                <div className="mb-1"><StatusBadge status={selected.status} />
                  <span className="ms-2 fw-semibold">{selected.quantity_per_household} {selected.item.unit} of {selected.item.name} per household</span>
                </div>
                <div className="text-secondary">
                  <CalendarDays size={13} className="me-1" />{fmtDate(selected.scheduled_at)}
                  <MapPin size={13} className="ms-3 me-1" />{selected.venue}
                </div>
                {selected.notes && <div className="text-secondary mt-1">{selected.notes}</div>}
              </div>
            </div>
          </section>

          <div className="row g-3 mb-3">
            <div className="col-md-3"><div className="rc-stat">
              <div className="rc-stat-label">Quota</div>
              <div className="rc-stat-value">{c?.quota ?? '—'}</div>
            </div></div>
            <div className="col-md-3"><div className="rc-stat green">
              <div className="rc-stat-label">Claimed</div>
              <div className="rc-stat-value green">{c?.claimed ?? '—'}</div>
            </div></div>
            <div className="col-md-3"><div className="rc-stat blue">
              <div className="rc-stat-label">Not yet claimed</div>
              <div className="rc-stat-value blue">{c?.not_yet_claimed ?? '—'}</div>
            </div></div>
            <div className="col-md-3"><div className="rc-stat">
              <div className="rc-stat-label">Quota left</div>
              <div className={`rc-stat-value ${c && c.quota_left === 0 ? 'danger' : ''}`}>{c?.quota_left ?? '—'}</div>
            </div></div>
          </div>

          <section className="rc-card">
            {c && <div className="mb-3" style={{ maxWidth: 360 }}><Progress claimed={c.claimed} quota={c.quota} /></div>}
            {c && c.quota < c.approved_households && (
              <p className="small text-secondary">
                The quota covers {c.quota} of your {c.approved_households} approved households, so not every
                household can claim in this event. Unclaimed households are listed highest priority first.
              </p>
            )}

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
                  <option value="unclaimed">Not yet claimed</option>
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
                          : <span className="rc-claim"><Clock size={13} /> Not yet</span>}
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
    </>
  )
}
