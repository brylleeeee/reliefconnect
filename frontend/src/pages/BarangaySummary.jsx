import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ClipboardList, MapPin, Package, Users, Wallet } from 'lucide-react'
import api, { errorMessage } from '../api/client'
import PageHeader from '../components/PageHeader'
import EventAnalytics from '../components/EventAnalytics'
import { periodLabel } from '../components/AnalyticsFilters'
import useLiveTick from '../components/useLiveTick'
import { peso } from '../components/format'
import { C } from '../chartColors'
import Select from '../components/Select'

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0)
const PER = { day: 'day', week: 'week', month: 'month' }

function Kpi({ label, value, sub, tone = '', icon: Icon }) {
  return (
    <div className={`rc-stat ${tone} h-100`}>
      <div className="rc-stat-label d-flex align-items-center gap-1">{Icon && <Icon size={12} />}{label}</div>
      <div className={`rc-stat-value ${tone}`}>{value}</div>
      {sub && <div className="small text-secondary">{sub}</div>}
    </div>
  )
}

/**
 * LGU Admin: "Barangay Summary" tab (sidebar, under Distribution Events). One barangay at a glance.
 * Opened from the Dashboard's "Needs attention" cards as /barangays/:id?from=&to= (keeps the
 * Dashboard's period so the numbers match the card that was clicked), or from the sidebar as
 * /barangays, which opens the barangay with the lowest coverage. The picker switches barangays.
 */
export default function BarangaySummary() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const from = params.get('from') || undefined
  const to = params.get('to') || undefined
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const tick = useLiveTick()
  const keepPeriod = from && to ? `?from=${from}&to=${to}` : ''

  // Opened from the sidebar without a barangay: go to the one with the lowest coverage
  useEffect(() => {
    if (id) return
    api.get('/admin/analytics', { params: { from, to } }).then((r) => {
      const ranked = r.data.by_barangay
        .filter((b) => b.registered > 0)
        .sort((a, b) => pct(a.reached, a.registered) - pct(b.reached, b.registered))
      const first = ranked[0] ?? r.data.options.barangays[0]
      if (first) navigate(`/barangays/${first.id}${keepPeriod}`, { replace: true })
    }).catch((err) => setError(errorMessage(err)))
  }, [id])

  const load = () => api.get('/admin/analytics', { params: { barangay_id: id, from, to } })
    .then((r) => { setD(r.data); setError('') })
    .catch((err) => setError(errorMessage(err)))
  useEffect(() => { if (id) { setD(null); load() } }, [id, from, to])
  useEffect(() => { if (tick && id) load() }, [tick])

  const b = d?.by_barangay[0]
  const k = d?.kpis
  const period = d ? periodLabel(d.filters.from, d.filters.to) : ''
  const mix = d?.priority_mix
  const mixTotal = mix ? mix.high + mix.medium + mix.low : 0
  const verified = d ? d.verification.qr + d.verification.reference_number : 0

  return (
    <>
      <PageHeader
        title={b ? `${b.name} summary` : 'Barangay summary'}
        subtitle={d ? `Relief distribution in this barangay, ${period}` : 'Loading…'}
        actions={d && (
          <Select className="form-select" aria-label="Barangay" value={id} style={{ minWidth: 200 }}
                  onChange={(e) => navigate(`/barangays/${e.target.value}${keepPeriod}`)}>
            {d.options.barangays.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        )}
      />

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {!d && !error && <p className="text-secondary">Loading…</p>}

      {k && b && (
        <>
          <div className="row g-3 mb-3">
            <div className="col-6 col-lg-3"><Kpi label="Registered households" tone="green" icon={Users}
                 value={b.registered.toLocaleString()} /></div>
            <div className="col-6 col-lg-3"><Kpi label="Households reached" tone="blue" icon={MapPin}
                 value={`${pct(b.reached, b.registered)}%`} sub={`${b.reached.toLocaleString()} of ${b.registered.toLocaleString()} received aid`} /></div>
            <div className="col-6 col-lg-3"><Kpi label="Relief goods released" icon={Package}
                 value={k.units_distributed.toLocaleString()} sub="units in this period" /></div>
            <div className="col-6 col-lg-3"><Kpi label="Cash aid released" icon={Wallet}
                 value={peso(k.cash_released)} sub="in this period" /></div>
          </div>

          {b.pending > 0 && (
            <p className="small text-secondary d-flex align-items-center gap-2 mb-3">
              <ClipboardList size={15} />
              {b.pending} registration{b.pending === 1 ? ' is' : 's are'} waiting for the barangay's review.
            </p>
          )}

          <div className="row g-3 mb-3">
            <div className="col-lg-7">
              <section className="rc-card h-100">
                <h2 className="rc-card-title mb-1">Relief goods released per {PER[d.filters.granularity] ?? 'day'}</h2>
                <p className="small text-secondary">Units, {period}.</p>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer>
                    <BarChart data={d.daily} margin={{ left: -20, right: 6, top: 6 }}>
                      <CartesianGrid vertical={false} stroke={C.grid} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.max(0, Math.ceil(d.daily.length / 6) - 1)} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: '#eef1f5' }} />
                      <Bar dataKey="units" name="Units" fill={C.green} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
            <div className="col-lg-5">
              <section className="rc-card h-100">
                <h2 className="rc-card-title mb-1">Households by priority level</h2>
                <p className="small text-secondary">Approved households in {b.name} right now.</p>
                <div className="rc-cov-list">
                  {['high', 'medium', 'low'].map((level) => (
                    <div key={level} className="rc-cov-row">
                      <span className="rc-cov-name text-capitalize">{level}</span>
                      <div className="rc-progress flex-grow-1">
                        <span style={{ width: `${pct(mix[level], mixTotal)}%`, background: C[level] }} />
                      </div>
                      <span className="rc-cov-num">{mix[level]} · <b>{pct(mix[level], mixTotal)}%</b></span>
                    </div>
                  ))}
                </div>
                {verified > 0 && (
                  <p className="small text-secondary mt-3 mb-0">
                    {pct(d.verification.qr, verified)}% of claims in this period were verified by QR scan,
                    {' '}{pct(d.verification.reference_number, verified)}% by reference number.
                  </p>
                )}
              </section>
            </div>
          </div>

          <section className="rc-card">
            <h2 className="rc-card-title mb-1">Distribution events in {b.name}</h2>
            <p className="small text-secondary">Claimed, pending and unclaimed households, by purok.</p>
            <EventAnalytics barangayId={id} refreshKey={tick} />
          </section>
        </>
      )}
    </>
  )
}
