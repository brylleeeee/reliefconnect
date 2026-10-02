import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CheckCircle2, ClipboardList, MapPin, Package } from 'lucide-react'
import api from '../api/client'
import PageHeader from '../components/PageHeader'
import EventAnalytics from '../components/EventAnalytics'
import { C } from '../chartColors'

const TABS = [
  { key: 'overview', label: 'Overview (last 30 days)' },
  { key: 'events', label: 'Distribution Events' },
]
const LOW_COVERAGE = 50 // % of registered households reached
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0)

/** What the LGU should act on, built from the same numbers as the charts. */
function attentionItems(d) {
  const items = []

  d.stock.filter((s) => s.in_stock <= s.reorder_level).forEach((s) => items.push({
    icon: Package, tone: 'danger', to: '/inventory',
    text: <><b>{s.name}</b> is low: {s.in_stock.toLocaleString()} {s.unit} left (reorder at {s.reorder_level}).</>,
  }))

  d.by_barangay
    .filter((b) => b.registered > 0 && pct(b.reached, b.registered) < LOW_COVERAGE)
    .sort((a, b) => pct(a.reached, a.registered) - pct(b.reached, b.registered))
    .forEach((b) => items.push({
      icon: MapPin, tone: 'warning', to: '/events',
      text: <><b>{b.name}</b>: only {b.reached} of {b.registered} households reached ({pct(b.reached, b.registered)}%).</>,
    }))

  const pending = d.by_barangay.filter((b) => b.pending > 0).sort((a, b) => b.pending - a.pending)
  if (pending.length) {
    items.push({
      icon: ClipboardList, tone: 'info',
      text: <><b>{d.kpis.pending_registrations} registrations</b> waiting for barangay review
        ({pending.slice(0, 3).map((b) => `${b.pending} in ${b.name}`).join(', ')}{pending.length > 3 ? ', …' : ''}).</>,
    })
  }
  return items
}

function Kpi({ label, value, sub, tone = '' }) {
  return (
    <div className={`rc-stat ${tone} h-100`}>
      <div className="rc-stat-label">{label}</div>
      <div className={`rc-stat-value ${tone}`}>{value}</div>
      {sub && <div className="small text-secondary">{sub}</div>}
    </div>
  )
}

function Overview({ d }) {
  const k = d.kpis
  const attention = attentionItems(d)
  const verified = d.verification.qr + d.verification.reference_number
  const coverage = [...d.by_barangay]
    .filter((b) => b.registered > 0)
    .sort((a, b) => pct(a.reached, a.registered) - pct(b.reached, b.registered))
  const mix = d.priority_mix
  const mixTotal = mix.high + mix.medium + mix.low

  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-6 col-lg-3"><Kpi label="Registered households" tone="green" value={k.registered_households.toLocaleString()} /></div>
        <div className="col-6 col-lg-3"><Kpi label="Households reached" tone="blue" value={`${k.coverage_pct}%`}
             sub={`${k.households_reached_30d.toLocaleString()} received aid`} /></div>
        <div className="col-6 col-lg-3"><Kpi label="Units distributed" value={k.units_distributed_30d.toLocaleString()}
             sub={verified ? `${pct(d.verification.qr, verified)}% verified by QR scan` : null} /></div>
        <div className="col-6 col-lg-3"><Kpi label="Pending registrations" value={k.pending_registrations} /></div>
      </div>

      <section className="rc-card mb-3">
        <h2 className="rc-card-title">Needs attention</h2>
        {attention.length === 0 ? (
          <p className="small text-secondary mb-0 d-flex align-items-center gap-2">
            <CheckCircle2 size={16} className="text-success" /> Nothing needs attention right now.
          </p>
        ) : (
          <ul className="rc-attention">
            {attention.map(({ icon: Icon, tone, text, to }, i) => (
              <li key={i} className={tone}>
                <Icon size={16} />
                <span className="flex-grow-1">{text}</span>
                {to && <Link to={to} className="small">View</Link>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="row g-3">
        <div className="col-lg-7">
          <section className="rc-card h-100">
            <h2 className="rc-card-title mb-1">Coverage by barangay</h2>
            <p className="small text-secondary">Share of registered households that received aid. Lowest first.</p>
            <div className="rc-cov-list">
              {coverage.map((b) => {
                const p = pct(b.reached, b.registered)
                return (
                  <div key={b.id} className="rc-cov-row">
                    <span className="rc-cov-name">{b.name}</span>
                    <div className="rc-progress flex-grow-1">
                      <span style={{ width: `${p}%`, background: p < LOW_COVERAGE ? C.medium : C.green }} />
                    </div>
                    <span className="rc-cov-num">{b.reached}/{b.registered} · <b>{p}%</b></span>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <div className="col-lg-5 d-flex flex-column gap-3">
          <section className="rc-card">
            <h2 className="rc-card-title mb-1">Units distributed per day</h2>
            <div style={{ height: 150 }}>
              <ResponsiveContainer>
                <BarChart data={d.daily} margin={{ left: -20, right: 6, top: 6 }}>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={6} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#eef1f5' }} />
                  <Bar dataKey="units" name="Units" fill={C.green} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rc-card">
            <h2 className="rc-card-title mb-2">Priority mix</h2>
            <div className="rc-coverage mb-2" style={{ height: 10 }}>
              <span style={{ width: `${pct(mix.high, mixTotal)}%`, background: C.high }} />
              <span style={{ width: `${pct(mix.medium, mixTotal)}%`, background: C.medium }} />
              <span style={{ width: `${pct(mix.low, mixTotal)}%`, background: C.low }} />
            </div>
            <div className="d-flex gap-3 small">
              <span><span className="rc-dot" style={{ background: C.high }} />High <b>{mix.high}</b></span>
              <span><span className="rc-dot" style={{ background: C.medium }} />Medium <b>{mix.medium}</b></span>
              <span><span className="rc-dot" style={{ background: C.low }} />Low <b>{mix.low}</b></span>
            </div>
            <Link to="/prioritization" className="rc-link small d-inline-block mt-2">See allocation per barangay</Link>
          </section>
        </div>
      </div>
    </>
  )
}

export default function Analytics() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'events' ? 'events' : 'overview'
  const [d, setD] = useState(null)
  useEffect(() => { api.get('/admin/analytics').then((r) => setD(r.data)) }, [])

  return (
    <>
      <PageHeader title="Analytics Dashboard" subtitle="Municipal distribution performance" />

      <div className="rc-tabs mb-3" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key}
                  className={tab === t.key ? 'active' : ''}
                  onClick={() => setParams(t.key === 'overview' ? {} : { tab: t.key })}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (d ? <Overview d={d} /> : <p className="text-secondary">Loading…</p>)}
      {tab === 'events' && (
        <section className="rc-card">
          <EventAnalytics />
        </section>
      )}
    </>
  )
}
