import { useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
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

function Empty({ title, children }) {
  return (
    <div className="rc-chart-box d-flex flex-column">
      <div className="fw-semibold small">{title}</div>
      <div className="flex-grow-1 d-grid place-items-center text-center small text-secondary py-5" style={{ placeItems: 'center' }}>{children}</div>
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
  const overall = t ? ['Claimed', 'Pending', 'Unclaimed'].map((k) => ({ name: k, value: t[k.toLowerCase()] })).filter((x) => x.value > 0) : []

  return (
    <>
      <div className="row g-2 align-items-end mb-3">
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
        {d && (
          <div className="col small text-secondary">
            {!fixedEventId && <>
              {qtyUnit(d.event.quantity_per_household, d.event.item.unit)} of {d.event.item.name} per household
              {d.event.distribute_by && ` · distribute by ${fmtDate(d.event.distribute_by)}`}
            </>}
            {d.scope && <>{!fixedEventId && ' · '}{d.scope.name}'s distribution: <StatusBadge status={d.scope.status} /></>}
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {t && (
        <>
          <div className="row g-3 mb-3">
            <div className="col-6 col-md-3"><Kpi label="Quota (households)" value={t.quota} /></div>
            <div className="col-6 col-md-3"><Kpi label="Claimed" value={t.claimed} total={t.quota} tone="green" /></div>
            <div className="col-6 col-md-3"><Kpi label="Pending" value={t.pending} total={t.quota} tone="blue" /></div>
            <div className="col-6 col-md-3"><Kpi label="Unclaimed" value={t.unclaimed} total={t.quota} tone={t.unclaimed ? 'danger' : undefined} /></div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-lg-8">
              {d.scope ? (
                <ChartBox title={`${d.scope.name} by purok`} note={`Approved households: claimed vs ${notYet.toLowerCase()}`}
                          height={Math.max(200, d.by_purok.length * 38)}>
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
                <ChartBox title="Claimed, pending and unclaimed per barangay" note="Households. Click a barangay to see it in detail."
                          height={Math.max(200, d.per_barangay.length * 42)}>
                  <BarChart data={d.per_barangay.map((b) => ({ id: b.id, name: b.name, Claimed: b.claimed, Pending: b.pending, Unclaimed: b.unclaimed }))}
                            layout="vertical" margin={{ left: 10, right: 16 }}>
                    <CartesianGrid stroke={C.grid} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {Object.keys(COLORS).map((k) => (
                      <Bar key={k} dataKey={k} stackId="s" fill={COLORS[k]} cursor="pointer"
                           onClick={(row) => setBarangayId(String(row.id ?? row.payload?.id))} />
                    ))}
                  </BarChart>
                </ChartBox>
              )}
            </div>
            <div className="col-lg-4">
              <ChartBox title={d.scope ? d.scope.name : 'All barangays'} note={`${t.claimed} of ${t.quota} households claimed (${pct(t.claimed, t.quota)}%)`}>
                <PieChart>
                  <Pie data={overall} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {overall.map((x) => <Cell key={x.name} fill={COLORS[x.name]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ChartBox>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-lg-5">
              <ChartBox title="Reaching the most vulnerable" note="Approved households by priority level" height={200}>
                <BarChart data={d.by_priority.map((p) => ({ name: p.level[0].toUpperCase() + p.level.slice(1), Claimed: p.claimed, 'Not yet': p.not_claimed }))}
                          margin={{ right: 10 }}>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Claimed" fill={C.green} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Not yet" fill={C.low} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartBox>
            </div>
            <div className="col-lg-4">
              {t.claimed === 0 ? <Empty title="Claims per day">No claims recorded yet.</Empty> : (
              <ChartBox title="Claims per day" height={200}>
                <BarChart data={d.timeline.map((x) => ({ name: fmtDate(x.day).replace(/, \d{4}$/, ''), Claims: x.claims }))} margin={{ right: 10 }}>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Claims" fill={C.green} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartBox>
              )}
            </div>
            <div className="col-lg-3">
              {t.claimed === 0 ? <Empty title="How claims were verified">Shown once claims are recorded.</Empty> : (
              <ChartBox title="How claims were verified" height={200}>
                <PieChart>
                  <Pie data={[{ name: 'QR scan', value: d.methods.qr, fill: C.green }, { name: 'Reference no.', value: d.methods.reference_number, fill: C.blue }].filter((x) => x.value)}
                       dataKey="value" nameKey="name" innerRadius={40} outerRadius={65} paddingAngle={2}>
                    {['QR scan', 'Reference no.'].filter((n, i) => [d.methods.qr, d.methods.reference_number][i]).map((n) => (
                      <Cell key={n} fill={n === 'QR scan' ? C.green : C.blue} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ChartBox>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
