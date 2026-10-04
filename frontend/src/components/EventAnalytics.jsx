import { useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import api, { errorMessage } from '../api/client'
import { C } from '../chartColors'
import { StatusBadge } from './Badges'
import { fmtDate, qtyUnit } from './format'

const COLORS = { Claimed: C.green, Pending: C.blue, Unclaimed: C.high }
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0)

function ChartBox({ title, note, height = 240, children }) {
  return (
    <div className="rc-chart-box">
      <div className="fw-semibold small">{title}</div>
      {note && <div className="small text-secondary mb-1">{note}</div>}
      <div style={{ height }}><ResponsiveContainer>{children}</ResponsiveContainer></div>
    </div>
  )
}

function Kpi({ label, value, total, tone }) {
  return (
    <div className={`rc-stat ${tone ?? ''}`}>
      <div className="rc-stat-label">{label}</div>
      <div className={`rc-stat-value ${tone ?? ''}`}>{value.toLocaleString()}</div>
      {total !== undefined && <div className="small text-secondary">{pct(value, total)}% of quota</div>}
    </div>
  )
}

/**
 * Claimed / pending / unclaimed analytics for a distribution event, for all barangays or one.
 * Without `eventId` it shows an event picker (Analytics page); with it, it's fixed to that
 * event (event View window). Change `refreshKey` to reload, e.g. on a live timer.
 */
export default function EventAnalytics({ eventId: fixedEventId, refreshKey }) {
  const [events, setEvents] = useState(null)
  const [eventId, setEventId] = useState(fixedEventId ? String(fixedEventId) : '')
  const [barangayId, setBarangayId] = useState('')
  const [d, setD] = useState(null)
  const [error, setError] = useState('')

  // Event picker: open events first (same order as the Distribution Events page)
  useEffect(() => {
    if (fixedEventId) return
    api.get('/admin/events').then((r) => {
      const list = r.data.events.data
      setEvents(list)
      // Default to the first event that already has claims, else the newest one
      setEventId((cur) => cur || String((list.find((e) => e.claimed > 0) ?? list[0])?.id ?? ''))
    }).catch((err) => setError(errorMessage(err)))
  }, [fixedEventId])

  useEffect(() => {
    if (!eventId) return
    api.get(`/admin/events/${eventId}/analytics`, { params: { barangay_id: barangayId || undefined } })
      .then((r) => { setD(r.data); setError('') })
      .catch((err) => setError(errorMessage(err)))
  }, [eventId, barangayId, refreshKey])

  if (events?.length === 0) return <p className="small text-secondary mb-0">No distribution events yet.</p>

  const t = d?.totals
  const done = d && (d.event.status === 'closed' || d.scope?.status === 'closed')
  const notYet = done ? 'Unclaimed' : 'Pending'
  // Unclaimed only exists once a barangay has closed; hide an always-zero card while it runs
  const showUnclaimed = t && (done || t.unclaimed > 0)
  const kpiCount = t ? 2 + ((!done || t.pending > 0) ? 1 : 0) + (showUnclaimed ? 1 : 0) : 4
  const kpiCol = kpiCount === 4 ? 'col-6 col-md-3' : kpiCount === 3 ? 'col-12 col-md-4' : 'col-6'

  return (
    <>
      <div className="row g-2 align-items-end mb-2">
        {!fixedEventId && (
          <div className="col-md-6">
            <label className="rc-label" htmlFor="ea-event">Distribution event</label>
            <select id="ea-event" className="form-select" value={eventId}
                    onChange={(e) => { setBarangayId(''); setD(null); setEventId(e.target.value) }}>
              {events?.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.status})</option>)}
            </select>
          </div>
        )}
        <div className="col-md-4">
          <label className="rc-label" htmlFor="ea-brgy">Barangay</label>
          <select id="ea-brgy" className="form-select" value={barangayId} onChange={(e) => setBarangayId(e.target.value)}>
            <option value="">All barangays</option>
            {d?.barangays.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>
      {d && (!fixedEventId || d.scope) && (
        <div className="small text-secondary mb-3">
          {!fixedEventId && <>
            {qtyUnit(d.event.quantity_per_household, d.event.item.unit)} {d.event.item.unit === 'PHP' ? 'from the' : 'of'} {d.event.item.name} per {d.event.per_member ? d.event.recipient_label : 'household'}
            {d.event.eligibility !== 'all' && <> · for {d.event.eligibility_label.toLowerCase()}</>}
            {d.event.distribute_by && ` · distribute by ${fmtDate(d.event.distribute_by)}`}
          </>}
          {d.scope && <>{!fixedEventId && ' · '}{d.scope.name}'s distribution: <StatusBadge status={d.scope.status} /></>}
        </div>
      )}

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {t && (
        <>
          <div className="row g-3 mb-3">
            <div className={kpiCol}><Kpi label="Quota (households)" value={t.quota} /></div>
            <div className={kpiCol}><Kpi label="Claimed" value={t.claimed} total={t.quota} tone="green" /></div>
            {(!done || t.pending > 0) && <div className={kpiCol}><Kpi label="Pending" value={t.pending} total={t.quota} tone="blue" /></div>}
            {showUnclaimed && <div className={kpiCol}><Kpi label="Unclaimed" value={t.unclaimed} total={t.quota} tone="danger" /></div>}
          </div>

          {d.scope ? (
            <ChartBox title={`${d.scope.name} by purok`} note={`Approved households: claimed vs ${notYet.toLowerCase()}`}
                      height={Math.max(160, d.by_purok.length * 34)}>
              <BarChart data={d.by_purok.map((p) => ({ name: p.purok, Claimed: p.claimed, [notYet]: p.not_claimed }))}
                        layout="vertical" margin={{ left: 10, right: 16 }}>
                <CartesianGrid stroke={C.grid} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Claimed" stackId="s" fill={COLORS.Claimed} />
                <Bar dataKey={notYet} stackId="s" fill={COLORS[notYet]} />
              </BarChart>
            </ChartBox>
          ) : (
            <ChartBox title="Households per barangay" note="Click a barangay to see it by purok."
                      height={Math.max(160, d.per_barangay.length * 34)}>
              <BarChart data={d.per_barangay.map((b) => ({ id: b.id, name: b.name, Claimed: b.claimed, Pending: b.pending, Unclaimed: b.unclaimed }))}
                        layout="vertical" margin={{ left: 10, right: 16 }}>
                <CartesianGrid stroke={C.grid} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {Object.keys(COLORS).filter((k) => t[k.toLowerCase()] > 0).map((k) => (
                  <Bar key={k} dataKey={k} stackId="s" fill={COLORS[k]} cursor="pointer"
                       onClick={(row) => setBarangayId(String(row.id ?? row.payload?.id))} />
                ))}
              </BarChart>
            </ChartBox>
          )}

          <div className="rc-chart-box mt-3">
            <div className="fw-semibold small mb-2">Claimed by priority level</div>
            {d.by_priority.map((p) => {
              const total = p.claimed + p.not_claimed
              return (
                <div key={p.level} className="rc-cov-row">
                  <span className="rc-cov-name text-capitalize">{p.level}</span>
                  <div className="rc-progress flex-grow-1">
                    <span style={{ width: `${pct(p.claimed, total)}%`, background: C[p.level] ?? C.green }} />
                  </div>
                  <span className="rc-cov-num">{p.claimed}/{total} · <b>{pct(p.claimed, total)}%</b></span>
                </div>
              )
            })}
            {t.claimed > 0 && (
              <div className="small text-secondary mt-2">
                {pct(d.methods.qr, t.claimed)}% of claims verified by QR scan, {pct(d.methods.reference_number, t.claimed)}% by reference number
                {d.timeline.length > 0 && <> · claims recorded over {d.timeline.length} day{d.timeline.length === 1 ? '' : 's'}</>}.
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
