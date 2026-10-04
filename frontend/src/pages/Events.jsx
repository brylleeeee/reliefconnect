import { useEffect, useState } from 'react'
import { MapPin, Trash2, RefreshCw } from 'lucide-react'
import api, { errorMessage } from '../api/client'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import Progress from '../components/Progress'
import EventAnalytics from '../components/EventAnalytics'
import { StatusBadge } from '../components/Badges'
import { fmtDate, fmtDateTime, fmtTime, peso, qtyUnit, recipients as countOf } from '../components/format'
import ClaimDetailModal from '../components/ClaimDetailModal'
import useConfirm from '../components/useConfirm'
import useLiveTick from '../components/useLiveTick'

const STAGE_LABELS = { ongoing: 'distributing', scheduled: 'scheduled', unscheduled: 'not scheduled', closed: 'done' }

/** "2 distributing · 1 scheduled · 1 done" */
function Stages({ stages }) {
  const parts = ['ongoing', 'scheduled', 'unscheduled', 'closed'].filter((k) => stages[k] > 0)
  return (
    <div className="rc-stages">
      {parts.map((k) => <span key={k}>{stages[k]} {STAGE_LABELS[k]}</span>)}
    </div>
  )
}

const emptyForm = { name: '', relief_item_id: '', quantity_per_household: 1, eligibility: 'all', distribute_by: '', notes: '' }

/** "per household" or "per senior citizen", for labels. */
const perWhom = (e) => (e.per_member ? `per ${e.recipient_label}` : 'per household')

export default function Events() {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(null)   // { form, quotas: {barangayId: n}, options }
  const [viewingId, setViewingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = () => api.get('/admin/events', { params: { status: status || undefined, page } })
    .then((r) => { setData(r.data); setLoadError('') })
    .catch((err) => setLoadError(errorMessage(err)))
  useEffect(() => { load() }, [status, page])
  // Live: refresh the event list and counts in place (filter and page are kept)
  const tick = useLiveTick()
  useEffect(() => { if (tick) load() }, [tick])

  const openCreate = async () => {
    setError('')
    try {
      const r = await api.get('/admin/events/options')
      setCreating({ options: r.data, form: { ...emptyForm, relief_item_id: r.data.items[0]?.id ?? '' }, quotas: {} })
    } catch (err) {
      setLoadError(errorMessage(err))
    }
  }

  const [confirm, confirmDialog] = useConfirm()

  const act = async (event, action) => {
    const ok = await confirm(action === 'delete'
      ? { title: 'Delete event?', message: `"${event.name}" will be removed. This cannot be undone.`, confirmLabel: 'Delete event', danger: true }
      : { title: 'Close event for all barangays?',
          message: `Barangays still distributing "${event.name}" will be stopped, and unclaimed quota becomes available for other events.`,
          confirmLabel: 'Close event', danger: true })
    if (!ok) return false
    try {
      if (action === 'delete') await api.delete(`/admin/events/${event.id}`)
      else await api.post(`/admin/events/${event.id}/close`)
      setLoadError('')
      setNotice(action === 'delete' ? `Deleted ${event.name}.` : `Closed ${event.name}.`)
      load()
      return true
    } catch (err) {
      setNotice('')
      setLoadError(errorMessage(err))
      return false
    }
  }

  const stats = data?.stats

  return (
    <>
      <PageHeader title="Distribution Events"
                  subtitle="Set what each barangay receives. Barangays schedule and run their own distribution day." />

      {loadError && <div className="alert alert-danger py-2 small">{loadError}</div>}

      <div className="row g-3 mb-3">
        <div className="col-md-4"><div className="rc-stat green">
          <div className="rc-stat-label">Open events</div>
          <div className="rc-stat-value green">{stats?.open_events ?? '—'}</div>
        </div></div>
        <div className="col-md-4"><div className="rc-stat blue">
          <div className="rc-stat-label">Barangays distributing now</div>
          <div className="rc-stat-value blue">{stats?.barangays_distributing ?? '—'}</div>
        </div></div>
        <div className="col-md-4"><div className="rc-stat">
          <div className="rc-stat-label">Claims recorded today</div>
          <div className="rc-stat-value">{stats?.claimed_today ?? '—'}</div>
        </div></div>
      </div>

      {notice && <div className="alert alert-success py-2 small">{notice}</div>}

      <section className="rc-card">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
          <h2 className="rc-card-title mb-0">Events</h2>
          <div className="d-flex gap-2">
            <select className="form-select form-select-sm" aria-label="Filter by status" value={status}
                    onChange={(e) => { setPage(1); setStatus(e.target.value) }}>
              <option value="">All events</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
            <button className="btn btn-rc btn-sm text-nowrap" onClick={openCreate}>+ Create Event</button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="rc-table">
            <thead>
              <tr><th>Event</th><th>Distribute by</th><th>Status</th><th style={{ minWidth: 200 }}>Claimed vs quota</th><th /></tr>
            </thead>
            <tbody>
              {data?.events.data.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="fw-semibold">{e.name}</div>
                    <div className="small text-secondary">{e.item.name} · {qtyUnit(e.quantity_per_household, e.item.unit)} {perWhom(e)}</div>
                    {e.eligibility !== 'all' && <span className="rc-tag mt-1 d-inline-block">For: {e.eligibility_label}</span>}
                  </td>
                  <td className="small">{e.distribute_by ? fmtDate(e.distribute_by) : <span className="text-secondary">No deadline</span>}</td>
                  <td><StatusBadge status={e.status} /></td>
                  <td>
                    <Progress claimed={e.claimed} quota={e.quota} />
                    <Stages stages={e.stages} />
                  </td>
                  <td className="text-end text-nowrap">
                    <button className="btn btn-sm btn-rc-outline me-1" onClick={() => setViewingId(e.id)}>View</button>
                    {e.status === 'open' && (
                      <button className="btn btn-sm btn-outline-danger me-1" onClick={() => act(e, 'close')}>Close</button>
                    )}
                    {e.status === 'open' && e.claimed === 0 && e.stages.ongoing === 0 && e.stages.closed === 0 && (
                      <button className="btn-icon danger d-inline-grid align-middle" aria-label={`Delete ${e.name}`}
                              onClick={() => act(e, 'delete')}><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
              {data?.events.data.length === 0 && (
                <tr><td colSpan={5} className="text-center muted py-4">
                  No {status || ''} events yet. Create one to start a distribution.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination meta={data?.events} onPage={setPage} />
      </section>

      {creating && (
        <CreateEventModal state={creating} setState={setCreating} busy={busy} error={error}
          onClose={() => { setCreating(null); setError('') }}
          onSubmit={async (payload) => {
            setBusy(true); setError('')
            try {
              const r = await api.post('/admin/events', payload)
              setCreating(null)
              setNotice(`Created ${r.data.name}. Each barangay can now set its distribution day.`)
              load()
            } catch (err) { setError(errorMessage(err)) }
            finally { setBusy(false) }
          }} />
      )}

      {viewingId && (
        <EventDetailModal id={viewingId} tick={tick} onClose={() => { setViewingId(null); load() }} onAct={act} />
      )}
      {/* Last, so it appears above the event window when closing from there */}
      {confirmDialog}
    </>
  )
}

function CreateEventModal({ state, setState, busy, error, onClose, onSubmit }) {
  const { form, quotas, options } = state
  const [suggesting, setSuggesting] = useState(false)
  const [sosFirst, setSosFirst] = useState(true) // "Suggest by priority": cover SOS households first
  const item = options.items.find((i) => String(i.id) === String(form.relief_item_id))
  const perHousehold = Number(form.quantity_per_household) || 1

  const setForm = (k, v) => setState({ ...state, form: { ...form, [k]: v } })
  const setQuota = (id, v) => setState({ ...state, quotas: { ...quotas, [id]: v } })

  const rule = options.eligibility.find((r) => r.key === form.eligibility) ?? options.eligibility[0]
  const eligibleIn = (b) => b.eligible?.[rule.key] ?? b.approved_households
  const recipientsIn = (b) => b.recipients?.[rule.key] ?? b.approved_households
  const households = options.barangays.reduce((sum, b) => sum + (Number(quotas[b.id]) || 0), 0)
  // Barangays with active SOS first (most urgent at the top), then the rest A-Z
  const byPriority = [...options.barangays].sort((a, b) =>
    (a.sos?.rank ?? 999) - (b.sos?.rank ?? 999) || a.name.localeCompare(b.name))
  const sosBarangays = options.barangays.filter((b) => b.sos).length
  // Per-member rules: each household gets the amount for every qualifying member.
  // Estimate from each barangay's average; the server checks the exact stock needed.
  const recipients = options.barangays.reduce((sum, b) => {
    const q = Number(quotas[b.id]) || 0
    if (!q) return sum
    return sum + (rule.per_member ? Math.ceil((recipientsIn(b) / Math.max(eligibleIn(b), 1)) * q) : q)
  }, 0)
  const unitsNeeded = recipients * perHousehold
  const over = item && unitsNeeded > item.available
  const isCash = item?.type === 'cash'
  // "1,200 Packs" or "₱120,000"
  const amt = (n) => (isCash ? peso(n) : `${Number(n).toLocaleString()} ${item?.unit ?? 'units'}`)

  /** Fill quotas using the same priority-weighted split as the Aid Prioritization page. */
  const suggest = async () => {
    if (!item) return
    setSuggesting(true)
    try {
      // Households the stock can cover, allowing for several qualifying members per household
      const totalEligible = options.barangays.reduce((n, b) => n + eligibleIn(b), 0)
      const totalRecipients = options.barangays.reduce((n, b) => n + recipientsIn(b), 0)
      const perHouseholdUnits = perHousehold * (rule.per_member && totalEligible ? totalRecipients / totalEligible : 1)
      const packs = Math.floor(item.available / perHouseholdUnits)
      const r = await api.get('/admin/prioritization', {
        params: { relief_item_id: item.id, packs, eligibility: rule.key, mode: sosFirst ? 'sos_first' : 'share' },
      })
      setState({ ...state, quotas: Object.fromEntries(r.data.barangays.map((b) => [b.id, b.allocation || ''])) })
    } finally { setSuggesting(false) }
  }

  const submit = (e) => {
    e.preventDefault()
    onSubmit({
      ...form,
      distribute_by: form.distribute_by || null,
      quotas: options.barangays
        .filter((b) => Number(quotas[b.id]) > 0)
        .map((b) => ({ barangay_id: b.id, quota: Number(quotas[b.id]) })),
    })
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <Modal title="Create Distribution Event" size="lg" onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <p className="small text-secondary">
          You set what each barangay receives. Each barangay then picks its own date and venue,
          and starts and closes its distribution.
        </p>

        <label className="rc-label" htmlFor="ev-name">Event name</label>
        <input id="ev-name" className="form-control mb-3" required maxLength={150}
               placeholder="e.g. Typhoon Relief: Family Food Packs"
               value={form.name} onChange={(e) => setForm('name', e.target.value)} />

        <div className="row g-2 mb-3">
          <div className="col-md-8">
            <label className="rc-label" htmlFor="ev-item">What will be given</label>
            <select id="ev-item" className="form-select" required value={form.relief_item_id}
                    onChange={(e) => setForm('relief_item_id', e.target.value)}>
              <optgroup label="Relief goods">
                {options.items.filter((i) => i.type !== 'cash').map((i) => (
                  <option key={i.id} value={i.id}>{i.name} ({i.available.toLocaleString()} {i.unit} available)</option>
                ))}
              </optgroup>
              <optgroup label="Cash aid">
                {options.items.filter((i) => i.type === 'cash').map((i) => (
                  <option key={i.id} value={i.id}>{i.name} ({peso(i.available)} available)</option>
                ))}
              </optgroup>
            </select>
            {item?.reserved > 0 && (
              <div className="small text-secondary mt-1">
                {amt(item.reserved)} of {amt(item.in_stock)} {isCash ? 'is' : 'are'} already set aside for other open events.
              </div>
            )}
          </div>
          <div className="col-md-4">
            <label className="rc-label" htmlFor="ev-qty">
              {isCash ? `Amount per ${rule.per_member ? rule.recipient : 'household'} (₱)` : `${item?.unit ?? 'Units'} per ${rule.per_member ? rule.recipient : 'household'}`}
            </label>
            <input id="ev-qty" type="number" min="1" max={isCash ? 100000 : 50} className="form-control" required
                   value={form.quantity_per_household} onChange={(e) => setForm('quantity_per_household', e.target.value)} />
          </div>
        </div>

        <label className="rc-label" htmlFor="ev-who">Who can receive</label>
        <select id="ev-who" className="form-select" value={form.eligibility}
                onChange={(e) => setState({ ...state, form: { ...form, eligibility: e.target.value }, quotas: {} })}>
          {options.eligibility.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <div className="small text-secondary mt-1 mb-3">
          {rule.per_member
            ? `Given per ${rule.recipient}: a household with 2 qualifying members receives twice the amount.`
            : 'Given once per household.'}
        </div>

        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <label className="rc-label" htmlFor="ev-deadline">Distribute by (optional)</label>
            <input id="ev-deadline" type="date" className="form-control" min={today}
                   value={form.distribute_by} onChange={(e) => setForm('distribute_by', e.target.value)} />
          </div>
          <div className="col-md-8">
            <label className="rc-label" htmlFor="ev-notes">Instructions for barangays and residents (optional)</label>
            <input id="ev-notes" className="form-control" maxLength={1000}
                   placeholder="e.g. Bring your QR code or reference number. Priority lane for seniors and PWDs."
                   value={form.notes} onChange={(e) => setForm('notes', e.target.value)} />
          </div>
        </div>

        <div className="d-flex justify-content-between align-items-center mb-2">
          <div>
            <div className="rc-label mb-0">Quota per barangay (households)</div>
            <div className="small text-secondary">Leave blank or 0 for barangays not included.</div>
          </div>
          <div className="d-flex align-items-center gap-3">
            {sosBarangays > 0 && (
              <label className="small d-flex align-items-center gap-1 mb-0" title="Households that sent an SOS get a quota first, in priority order">
                <input type="checkbox" checked={sosFirst} onChange={(e) => setSosFirst(e.target.checked)} />
                SOS barangays first
              </label>
            )}
            <button type="button" className="btn btn-sm btn-rc-outline" disabled={!item || suggesting} onClick={suggest}>
              {suggesting ? 'Calculating…' : 'Suggest by priority'}
            </button>
          </div>
        </div>
        {sosBarangays > 0 && (
          <div className="small text-danger mb-2">
            {sosBarangays} barangay{sosBarangays === 1 ? ' has' : 's have'} active SOS. They are listed first, most urgent at the top.
          </div>
        )}
        <table className="rc-table mb-2">
          <thead><tr><th>Barangay</th><th>SOS priority</th><th>{rule.key === 'all' ? 'Approved households' : 'Eligible households'}</th><th style={{ width: 140 }}>Quota</th></tr></thead>
          <tbody>
            {byPriority.map((b) => (
              <tr key={b.id} className={b.sos ? `rc-row-sos ${b.sos.level}` : ''}>
                <td className="fw-semibold">{b.name}</td>
                <td className="text-nowrap" title={b.sos?.reason ?? ''}>
                  {b.sos
                    ? <><b>#{b.sos.rank}</b> <span className={`rc-prio ${b.sos.level}`}>{b.sos.level}</span> <span className="small text-secondary">{b.sos.count} SOS</span></>
                    : <span className="small text-secondary">—</span>}
                </td>
                <td className="muted">
                  {eligibleIn(b)}
                  {rule.per_member && <span className="small"> ({countOf(recipientsIn(b), rule.recipient)})</span>}
                </td>
                <td>
                  <input type="number" min="0" max={eligibleIn(b)} className="form-control form-control-sm"
                         aria-label={`Quota for ${b.name}`} value={quotas[b.id] ?? ''}
                         onChange={(e) => setQuota(b.id, e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={`small mb-4 ${over ? 'text-danger fw-semibold' : 'text-secondary'}`}>
          {rule.per_member
            ? <>{households.toLocaleString()} households (about {countOf(recipients, rule.recipient)}) × {isCash ? peso(perHousehold) : perHousehold} = about {amt(unitsNeeded)} needed</>
            : <>{households.toLocaleString()} households × {isCash ? peso(perHousehold) : perHousehold} = {amt(unitsNeeded)} needed</>}
          {item && ` of ${amt(item.available)} available`}.
        </p>

        <button className="btn btn-rc w-100" disabled={busy || !households || over}>
          {busy ? 'Creating…' : 'Create Event'}
        </button>
      </form>
    </Modal>
  )
}

function EventDetailModal({ id, tick, onClose, onAct }) {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')

  const load = () => api.get(`/admin/events/${id}`)
    .then((r) => { setD(r.data); setError('') })
    .catch((err) => setError(errorMessage(err)))

  // Live count: refresh every 10 seconds while any barangay is distributing
  const live = d?.event.status === 'open' && d.barangays.some((b) => b.status === 'ongoing')
  useEffect(() => { load() }, [id])
  useEffect(() => { if (tick) load() }, [tick]) // live, even before any barangay starts
  useEffect(() => {
    if (!live) return
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [live, id])

  const e = d?.event

  return (
    <Modal title={e?.name ?? 'Event'} size="lg" onClose={onClose}>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {!d ? (!error && <p className="text-secondary">Loading…</p>) : (
        <>
          <div className="rc-detail-grid mb-3">
            <div><div className="rc-label">Status</div><StatusBadge status={e.status} /></div>
            <div><div className="rc-label">Who can receive</div>{e.eligibility_label}</div>
            <div><div className="rc-label">Amount</div>{qtyUnit(e.quantity_per_household, e.item.unit)} {e.item.unit === 'PHP' ? 'from the' : 'of'} {e.item.name} {perWhom(e)}</div>
            <div><div className="rc-label">Stock left</div>{e.item.quantity_in_stock.toLocaleString()} {e.item.unit}</div>
            <div><div className="rc-label">Distribute by</div>{e.distribute_by ? fmtDate(e.distribute_by) : 'No deadline'}</div>
            <div><div className="rc-label">Created by</div>{e.creator?.name}</div>
          </div>
          {e.notes && <div className="rc-advisory mb-3 small">{e.notes}</div>}

          <div className="d-flex justify-content-between align-items-end mb-2">
            <div style={{ minWidth: 260 }}><Progress claimed={d.totals.claimed} quota={d.totals.quota} /></div>
            <div className="small text-secondary text-end">
              {live && <><RefreshCw size={12} className="me-1" />Updates every 10 seconds · </>}
              Last updated {fmtTime(d.refreshed_at)}
            </div>
          </div>

          <EventAnalytics eventId={id} refreshKey={d.refreshed_at} />

          <div className="mb-4" />

          <h3 className="rc-card-title">Barangay distribution days</h3>
          <div className="table-responsive mb-4">
            <table className="rc-table">
              <thead><tr><th>Barangay</th><th>Distribution day</th><th>Status</th><th>Claimed / quota</th></tr></thead>
              <tbody>
                {d.barangays.map((b) => (
                  <tr key={b.id}>
                    <td className="fw-semibold">{b.name}</td>
                    <td className="small">
                      {b.scheduled_at ? (
                        <>
                          <div>{fmtDateTime(b.scheduled_at)}</div>
                          <div className="text-secondary"><MapPin size={12} className="me-1" />{b.venue}</div>
                        </>
                      ) : <span className="text-secondary">Barangay hasn't set a date yet</span>}
                    </td>
                    <td><StatusBadge status={b.status} /></td>
                    <td>{b.claimed} / {b.quota}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ClaimsList eventId={id} barangays={d.barangays} refreshKey={d.refreshed_at} />

          {e.status === 'open' && (
            <div className="d-flex justify-content-end">
              <button className="btn btn-outline-danger" onClick={async () => { if (await onAct(e, 'close')) load() }}>
                Close Event for All Barangays
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

/** Every claim of an event, searchable; click a claim to see all of its details. */
function ClaimsList({ eventId, barangays, refreshKey }) {
  const [filters, setFilters] = useState({ barangay_id: '', search: '' })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    const params = Object.fromEntries(Object.entries({ ...filters, page }).filter(([, v]) => v))
    api.get(`/admin/events/${eventId}/claims`, { params }).then((r) => setData(r.data))
  }, [eventId, filters, page, refreshKey])
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setFilters((f) => ({ ...f, search })) }, 350)
    return () => clearTimeout(t)
  }, [search])

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-2">
        <div>
          <h3 className="rc-card-title mb-0">Claims{data ? ` (${data.total})` : ''}</h3>
          <div className="small text-secondary">Click a claim to see the household, members, and how it was released.</div>
        </div>
        <div className="d-flex gap-2">
          <select className="form-select form-select-sm" aria-label="Filter by barangay" value={filters.barangay_id}
                  onChange={(e) => { setPage(1); setFilters({ ...filters, barangay_id: e.target.value }) }}>
            <option value="">All barangays</option>
            {barangays.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input className="form-control form-control-sm" placeholder="Search name or reference no." aria-label="Search claims"
                 value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="table-responsive mb-2">
        <table className="rc-table">
          <thead><tr><th>Time</th><th>Household</th><th>Barangay</th><th>Received</th><th>Verified by</th><th>Released by</th></tr></thead>
          <tbody>
            {data?.data.map((c) => (
              <tr key={c.id} className="rc-row-click" tabIndex={0} onClick={() => setOpenId(c.id)}
                  onKeyDown={(ev) => { if (ev.key === 'Enter') setOpenId(c.id) }}>
                <td className="text-nowrap">{fmtDateTime(c.distributed_at)}</td>
                <td><div className="fw-semibold">{c.household_head}</div><div className="small text-secondary">{c.reference_number}</div></td>
                <td>{c.barangay}<div className="small text-secondary">{c.purok}</div></td>
                <td className="text-nowrap">{c.quantity_label}</td>
                <td>
                  {c.verification_method === 'qr' ? 'QR scan' : 'Reference no.'}
                  {c.synced_from_offline && <span className="rc-tag ms-1">Offline</span>}
                </td>
                <td className="muted">{c.released_by}</td>
              </tr>
            ))}
            {data?.data.length === 0 && (
              <tr><td colSpan={6} className="text-center muted py-3">
                {filters.search || filters.barangay_id ? 'No claims match these filters.' : 'Claims will appear here once a barangay starts distributing.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination meta={data} onPage={setPage} />
      <div className="mb-3" />
      {openId && <ClaimDetailModal url={`/admin/claims/${openId}`} onClose={() => setOpenId(null)} />}
    </>
  )
}
