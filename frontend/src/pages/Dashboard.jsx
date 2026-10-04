import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CheckCircle2, ClipboardList, MapPin, Megaphone, Package, SquarePen, Trash2, Users, Wallet } from 'lucide-react'
import api, { errorMessage } from '../api/client'
import PageHeader from '../components/PageHeader'
import EventAnalytics from '../components/EventAnalytics'
import LguAnnouncementModal from '../components/LguAnnouncementModal'
import Pagination from '../components/Pagination'
import useConfirm from '../components/useConfirm'
import useLiveTick from '../components/useLiveTick'
import { peso } from '../components/format'
import { C } from '../chartColors'

const LOW_COVERAGE = 50 // % of registered households reached
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0)

function formatWhen(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return `Today · ${time}`
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

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

function Kpi({ label, value, sub, tone = '', icon: Icon }) {
  return (
    <div className={`rc-stat ${tone} h-100`}>
      <div className="rc-stat-label d-flex align-items-center gap-1">{Icon && <Icon size={12} />}{label}</div>
      <div className={`rc-stat-value ${tone}`}>{value}</div>
      {sub && <div className="small text-secondary">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [d, setD] = useState(null)
  const [announcements, setAnnouncements] = useState(null)
  const [annPage, setAnnPage] = useState(1)
  const [composing, setComposing] = useState(null) // { editing: announcement | null }
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const tick = useLiveTick()
  const loadAnalytics = () => api.get('/admin/analytics').then((r) => { setD(r.data); setError('') })
    .catch((err) => { if (!d) setError(errorMessage(err)) })
  const loadAnnouncements = () => api.get('/admin/announcements', { params: { page: annPage } })
    .then((r) => setAnnouncements(r.data))
  useEffect(() => { loadAnalytics() }, [])
  useEffect(() => { loadAnnouncements() }, [annPage])
  // Live: refresh the numbers, charts and announcements in place
  useEffect(() => { if (tick) { loadAnalytics(); loadAnnouncements() } }, [tick])

  const [confirm, confirmDialog] = useConfirm()

  const remove = async (a) => {
    const ok = await confirm({
      title: 'Delete announcement?',
      message: `"${a.title}" will be removed and barangays will no longer see it. Copies they already sent to their residents stay.`,
      confirmLabel: 'Delete', danger: true,
    })
    if (!ok) return
    await api.delete(`/admin/announcements/${a.id}`)
    setNotice(`Deleted "${a.title}".`)
    loadAnnouncements()
  }

  const k = d?.kpis
  const attention = d ? attentionItems(d) : []
  const coverage = d ? [...d.by_barangay].filter((b) => b.registered > 0)
    .sort((a, b) => pct(a.reached, a.registered) - pct(b.reached, b.registered)) : []

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Municipal relief distribution at a glance"
        actions={(
          <button className="btn btn-rc d-flex align-items-center gap-2" onClick={() => setComposing({ editing: null })}>
            <Megaphone size={15} /> Publish Announcement
          </button>
        )}
      />

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {notice && <div className="alert alert-success py-2 small">{notice}</div>}

      {k && (
        <>
          <div className="row g-3 mb-3">
            <div className="col-6 col-lg-3"><Kpi label="Registered households" tone="green" icon={Users}
                 value={k.registered_households.toLocaleString()} sub={`${k.pending_registrations} awaiting barangay review`} /></div>
            <div className="col-6 col-lg-3"><Kpi label="Households reached" tone="blue" icon={MapPin} value={`${k.coverage_pct}%`}
                 sub={`${k.households_reached_30d.toLocaleString()} received aid in 30 days`} /></div>
            <div className="col-6 col-lg-3"><Kpi label="Relief goods released" icon={Package}
                 value={k.units_distributed_30d.toLocaleString()} sub="units in the last 30 days" /></div>
            <div className="col-6 col-lg-3"><Kpi label="Cash aid released" icon={Wallet}
                 value={peso(k.cash_released_30d)} sub={`${peso(k.cash_available)} left in cash funds`} /></div>
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

          <div className="row g-3 mb-3">
            <div className="col-lg-7">
              <section className="rc-card h-100">
                <h2 className="rc-card-title mb-1">Coverage by barangay</h2>
                <p className="small text-secondary">Share of registered households that received aid in the last 30 days. Lowest first.</p>
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
            <div className="col-lg-5">
              <section className="rc-card h-100">
                <h2 className="rc-card-title mb-1">Relief goods released per day</h2>
                <p className="small text-secondary">Units, last 30 days.</p>
                <div style={{ height: 180 }}>
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
            </div>
          </div>
        </>
      )}
      {!d && !error && <p className="text-secondary">Loading…</p>}

      <section className="rc-card mb-3">
        <h2 className="rc-card-title mb-1">Distribution events</h2>
        <p className="small text-secondary">Claimed, pending and unclaimed households. Choose a barangay to see it by purok.</p>
        <EventAnalytics refreshKey={tick} />
      </section>

      <section className="rc-card">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="rc-card-title mb-0">Announcements sent to barangays</h2>
          <span className="small text-secondary">Barangays relay these to their residents</span>
        </div>
        {announcements?.data.length === 0 && (
          <p className="text-secondary small mb-0">No announcements yet. Use “Publish Announcement” at the top of the page.</p>
        )}
        {announcements?.data.map((a) => (
          <div className="rc-advisory" key={a.id}>
            <div className="flex-grow-1">
              <div>
                <span className="rc-advisory-tag">{a.category}</span>
                <span className="rc-advisory-time">{formatWhen(a.published_at)}</span>
              </div>
              <div className="rc-advisory-title">{a.title}</div>
              <div className="rc-advisory-desc">{a.description}</div>
              <div className="rc-advisory-meta">
                <Users size={12} />
                To {a.target_barangays.length ? a.target_barangays.map((b) => b.name).join(', ') : 'all barangays'}
                <span className={a.relayed_count < a.target_count ? 'text-warning-emphasis' : 'text-success'}>
                  · Relayed to residents by {a.relayed_count} of {a.target_count}
                </span>
              </div>
            </div>
            <button className="btn-icon" onClick={() => setComposing({ editing: a })} aria-label={`Edit ${a.title}`}><SquarePen size={14} /></button>
            <button className="btn-icon danger" onClick={() => remove(a)} aria-label={`Delete ${a.title}`}><Trash2 size={14} /></button>
          </div>
        ))}
        <Pagination meta={announcements} onPage={setAnnPage} />
      </section>

      {confirmDialog}

      {composing && (
        <LguAnnouncementModal editing={composing.editing} onClose={() => setComposing(null)}
          onSaved={() => {
            setNotice(composing.editing ? 'Announcement updated.' : 'Announcement published to the barangays.')
            setComposing(null); setAnnPage(1); loadAnnouncements()
          }} />
      )}
    </>
  )
}
