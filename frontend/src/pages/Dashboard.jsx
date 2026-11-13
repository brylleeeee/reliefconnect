import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CheckCircle2, ClipboardList, MapPin, Megaphone, Package, SquarePen, Trash2, Users, Wallet } from 'lucide-react'
import api, { errorMessage } from '../api/client'
import PageHeader from '../components/PageHeader'
import EventAnalytics from '../components/EventAnalytics'
import AnalyticsFilters, { defaultFilters, periodLabel } from '../components/AnalyticsFilters'
import LguAnnouncementModal from '../components/LguAnnouncementModal'
import Pagination, { pageOf } from '../components/Pagination'
import useConfirm from '../components/useConfirm'
import useLiveTick from '../components/useLiveTick'
import { peso } from '../components/format'
import { C } from '../chartColors'

const LOW_COVERAGE = 50 // % of registered households reached
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0)
const PER = { day: 'day', week: 'week', month: 'month' }

function formatWhen(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return `Today · ${time}`
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

const ATTENTION_PER_PAGE = 6
const COVERAGE_PER_PAGE = 7
const ANNOUNCEMENTS_PER_PAGE = 5

/**
 * "Battery" look for a Needs attention card: the fill grows with the coverage % (0% = empty,
 * 49% = about half full), and its color slides from red at 0% to amber just under LOW_COVERAGE.
 */
function batteryStyle(p) {
  const t = Math.min(1, Math.max(0, p / LOW_COVERAGE))
  const hue = Math.round(t * 40)
  return {
    '--attn-level': Math.min(1, Math.max(0, p / 100)),
    '--attn-edge': `hsl(${hue} 70% 50%)`,
    '--attn-charge': `hsl(${hue} 85% 84%)`,
    '--attn-text': `hsl(${hue} 80% 30%)`,
  }
}

/** Barangays whose coverage is below LOW_COVERAGE, lowest first. Each one is a card on the Dashboard. */
function lowCoverage(d) {
  return d.by_barangay
    .filter((b) => b.registered > 0 && pct(b.reached, b.registered) < LOW_COVERAGE)
    .map((b) => ({ ...b, pct: pct(b.reached, b.registered) }))
    .sort((a, b) => a.pct - b.pct)
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
  const [filters, setFilters] = useState(defaultFilters)
  const [loadingFilters, setLoadingFilters] = useState(false)
  const latest = useRef(0) // ignore slow responses for filters that were already changed
  const [announcements, setAnnouncements] = useState(null)
  const [annPage, setAnnPage] = useState(1)
  const [attnPage, setAttnPage] = useState(1)
  const [covPage, setCovPage] = useState(1)
  const [composing, setComposing] = useState(null) // { editing: announcement | null }
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const tick = useLiveTick()
  const loadAnalytics = () => {
    const id = ++latest.current
    const { from, to, barangay_id, relief_item_id } = filters
    return api.get('/admin/analytics', { params: { from, to, barangay_id: barangay_id || undefined, relief_item_id: relief_item_id || undefined } })
      .then((r) => { if (id === latest.current) { setD(r.data); setError('') } })
      .catch((err) => { if (id === latest.current) setError(errorMessage(err)) })
      .finally(() => { if (id === latest.current) setLoadingFilters(false) })
  }
  const loadAnnouncements = () => api.get('/admin/announcements', { params: { page: annPage, per_page: ANNOUNCEMENTS_PER_PAGE } })
    .then((r) => setAnnouncements(r.data))
  useEffect(() => { setLoadingFilters(true); setAttnPage(1); setCovPage(1); loadAnalytics() }, [filters])
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
  const f = d?.filters
  const period = f ? periodLabel(f.from, f.to) : ''
  const scope = [
    f?.barangay_id && d.options.barangays.find((b) => b.id === Number(f.barangay_id))?.name,
    f?.relief_item_id && d.options.items.find((i) => i.id === Number(f.relief_item_id))?.name,
  ].filter(Boolean).join(' · ')
  const perLabel = PER[f?.granularity] ?? 'day'
  const attention = d ? lowCoverage(d) : []
  const { rows: attnShown, meta: attnMeta } = pageOf(attention, attnPage, ATTENTION_PER_PAGE)
  const lowStock = d ? d.stock.filter((s) => s.in_stock <= s.reorder_level) : []
  const summaryLink = (b) => `/barangays/${b.id}?from=${f.from}&to=${f.to}`
  const coverage = d ? [...d.by_barangay].filter((b) => b.registered > 0)
    .sort((a, b) => pct(a.reached, a.registered) - pct(b.reached, b.registered)) : []
  const { rows: coverageShown, meta: coverageMeta } = pageOf(coverage, covPage, COVERAGE_PER_PAGE)

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

      <AnalyticsFilters value={filters} onChange={setFilters} options={d?.options} />

      {k && (
        <div style={{ opacity: loadingFilters ? 0.55 : 1, transition: 'opacity .15s' }} aria-busy={loadingFilters}>
          <p className="small text-secondary mb-2">
            Showing <b>{period}</b>{scope ? <> for <b>{scope}</b></> : ' for the whole municipality'}.
          </p>
          <div className="row g-3 mb-3">
            <div className="col-6 col-lg-3"><Kpi label="Registered households" tone="green" icon={Users}
                 value={k.registered_households.toLocaleString()} sub={`${k.pending_registrations} awaiting barangay review`} /></div>
            <div className="col-6 col-lg-3"><Kpi label="Households reached" tone="blue" icon={MapPin} value={`${k.coverage_pct}%`}
                 sub={`${k.households_reached.toLocaleString()} received aid in this period`} /></div>
            <div className="col-6 col-lg-3"><Kpi label="Relief goods released" icon={Package}
                 value={k.units_distributed.toLocaleString()} sub="units in this period" /></div>
            <div className="col-6 col-lg-3"><Kpi label="Cash aid released" icon={Wallet}
                 value={peso(k.cash_released)} sub={`${peso(k.cash_available)} left in cash funds`} /></div>
          </div>

          <section className="rc-card mb-3">
            <div className="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
              <h2 className="rc-card-title mb-0">Needs attention</h2>
              <div className="rc-attn-notes">
                {lowStock.length > 0 && (
                  <Link to="/inventory" className="danger"><Package size={13} /> {lowStock.length} item{lowStock.length === 1 ? '' : 's'} low on stock</Link>
                )}
                {k.pending_registrations > 0 && (
                  <span><ClipboardList size={13} /> {k.pending_registrations} registration{k.pending_registrations === 1 ? '' : 's'} awaiting barangay review</span>
                )}
              </div>
            </div>
            {attention.length === 0 ? (
              <p className="small text-secondary mb-0 d-flex align-items-center gap-2">
                <CheckCircle2 size={16} className="text-success" /> Every barangay has reached at least {LOW_COVERAGE}% of its households.
              </p>
            ) : (
              <>
                <p className="small text-secondary mb-2">Barangays below {LOW_COVERAGE}% coverage, lowest first. Open one to see its summary.</p>
                <ul className="rc-attn-grid">
                  {attnShown.map((b) => (
                    <li key={b.id}>
                      <Link to={summaryLink(b)} className="rc-attn-card" style={batteryStyle(b.pct)}
                            title={`${b.reached} of ${b.registered} households reached`}>
                        <span className="rc-attn-charge" aria-hidden="true" />
                        <span className="rc-attn-name">{b.name}</span>
                        <span className="rc-attn-pct">{b.pct}%</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Pagination meta={attnMeta} onPage={(p) => setAttnPage(p)} />
              </>
            )}
          </section>

          <div className="row g-3 mb-3">
            <div className="col-lg-7">
              <section className="rc-card h-100">
                <h2 className="rc-card-title mb-1">Coverage by barangay</h2>
                <p className="small text-secondary">Share of registered households that received aid in this period. Lowest first.</p>
                <div className="rc-cov-list">
                  {coverageShown.map((b) => {
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
                  {coverage.length === 0 && <p className="small text-secondary mb-0">No registered households here yet.</p>}
                </div>
                <Pagination meta={coverageMeta} onPage={setCovPage} />
              </section>
            </div>
            <div className="col-lg-5">
              <section className="rc-card h-100">
                <h2 className="rc-card-title mb-1">Relief goods released per {perLabel}</h2>
                <p className="small text-secondary">Units, {period}.</p>
                <div style={{ height: 180 }}>
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
          </div>
        </div>
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
