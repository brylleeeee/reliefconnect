import { useEffect, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { CheckCheck, Info, Sparkles, TriangleAlert } from 'lucide-react'
import api, { errorMessage } from '../api/client'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import useConfirm from '../components/useConfirm'
import useLiveTick, { useLiveUpdatedAt } from '../components/useLiveTick'
import { C, SOS_LEVEL } from '../chartColors'

const waiting = (min) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`)

export default function SosPrioritization() {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showRules, setShowRules] = useState(false)
  const [confirm, confirmDialog] = useConfirm()

  const load = () => api.get('/admin/sos').then((r) => { setD(r.data); setError('') })
    .catch((e) => { if (!d) setError(errorMessage(e)) })

  useEffect(() => { load() }, [])
  // Live: new SOS from the mobile app appear and re-rank without reloading
  const tick = useLiveTick()
  useEffect(() => { if (tick) load() }, [tick])
  const updatedAt = useLiveUpdatedAt()

  const serve = async (row) => {
    const ok = await confirm({
      title: `Relief goods delivered to ${row.name}?`,
      message: `This closes ${row.sos_count} SOS (${row.people} people) from ${row.name}. The ranking will move on to the next barangay.`,
      confirmLabel: 'Mark as served',
    })
    if (!ok) return
    await api.post(`/admin/sos/barangays/${row.id}/serve`)
    setNotice(`${row.name} marked as served.`)
    load()
  }

  if (error) return <><PageHeader title="SOS Prioritization" subtitle="" /><div className="alert alert-danger">{error}</div></>
  if (!d) return <PageHeader title="SOS Prioritization" subtitle="Loading…" />

  const { summary: s, top, ranking } = d
  const ai = d.engine === 'ai'

  return (
    <>
      <PageHeader
        title="SOS Prioritization"
        subtitle="Residents press SOS when they need relief goods. The barangay asking for the most help is ranked first"
        actions={<span className="rc-live">Live · updated {updatedAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</span>}
      />

      {notice && <div className="alert alert-success py-2" role="status">{notice}</div>}

      <div className={`small mb-3 d-flex align-items-center gap-2 ${ai ? 'text-success' : 'text-warning-emphasis'}`}>
        <Sparkles size={14} />
        {ai ? 'Ranking calculated by AI'
          : 'AI is not connected, so a standard formula is ranking the barangays. Add GEMINI_API_KEY to the backend .env to turn it on.'}
      </div>

      {top ? (
        <section className="rc-card rc-sos-top mb-3">
          <TriangleAlert size={30} color={SOS_LEVEL.critical} />
          <div>
            <div className="rc-stat-label">Give relief goods first to</div>
            <div className="name">Barangay {top.name}</div>
          </div>
          <div className="small text-secondary flex-grow-1" style={{ minWidth: 220 }}>
            {top.sos_count} households ({top.people} people) pressed SOS. The longest wait is {waiting(top.waiting_minutes)}.
            {top.reason && <> <b>Why:</b> {top.reason}</>}
          </div>
          <button className="btn btn-rc d-flex align-items-center gap-2" onClick={() => serve(top)}>
            <CheckCheck size={15} /> Mark as served
          </button>
        </section>
      ) : (
        <section className="rc-card mb-3 text-secondary">No active SOS right now. When a resident presses SOS in the app, it shows up here within seconds.</section>
      )}

      <div className="row g-3 mb-3">
        <div className="col-6 col-md-3"><div className="rc-stat">
          <div className="rc-stat-label">Households asking</div>
          <div className="rc-stat-value danger">{s.active}</div>
        </div></div>
        <div className="col-6 col-md-3"><div className="rc-stat">
          <div className="rc-stat-label">People affected</div>
          <div className="rc-stat-value">{s.people.toLocaleString()}</div>
        </div></div>
        <div className="col-6 col-md-3"><div className="rc-stat">
          <div className="rc-stat-label">Barangays asking</div>
          <div className="rc-stat-value">{s.barangays_asking}<span className="fs-6 text-secondary"> of {s.barangays_total}</span></div>
        </div></div>
        <div className="col-6 col-md-3"><div className="rc-stat green">
          <div className="rc-stat-label">SOS served</div>
          <div className="rc-stat-value green">{s.served}</div>
        </div></div>
      </div>

      <div className="row g-3 mb-3">
        <section className="col-lg-6">
          <div className="rc-card h-100">
            <div className="d-flex align-items-center gap-2 mb-2">
              <h2 className="rc-card-title mb-0">Priority score per barangay</h2>
              <button type="button" className="btn btn-link p-0 text-secondary d-inline-flex"
                      onClick={() => setShowRules(true)} aria-label="How the ranking works" title="How the ranking works">
                <Info size={16} />
              </button>
            </div>
            {ranking.length === 0 ? <p className="text-secondary small">Nothing to rank yet.</p> : (
              <div style={{ height: Math.max(240, ranking.length * 34 + 60) }}>
                <ResponsiveContainer>
                  <BarChart data={ranking} layout="vertical" margin={{ left: 10, right: 24 }} barCategoryGap="25%">
                    <CartesianGrid horizontal={false} stroke={C.grid} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12 }} interval={0} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} formatter={(v) => [v, 'Score']} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                      {ranking.map((r) => <Cell key={r.id} fill={SOS_LEVEL[r.level]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="small text-secondary mt-2">
              {Object.entries(SOS_LEVEL).map(([k, c]) => (
                <span key={k} className="me-3 text-capitalize"><span className="rc-dot" style={{ background: c }} />{k}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="col-lg-6">
          <div className="rc-card h-100">
            <h2 className="rc-card-title">Households and people asking, per barangay</h2>
            {ranking.length === 0 ? <p className="text-secondary small">No active SOS.</p> : (
              <div style={{ height: Math.max(240, ranking.length * 34 + 60) }}>
                <ResponsiveContainer>
                  <BarChart data={ranking} layout="vertical" margin={{ left: 10, right: 24 }} barCategoryGap="25%">
                    <CartesianGrid horizontal={false} stroke={C.grid} />
                    <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12 }} interval={0} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="sos_count" name="Households (SOS)" fill={C.high} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="people" name="People" fill={C.blue} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="rc-card mb-3">
        <h2 className="rc-card-title">New SOS in the last 24 hours</h2>
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <AreaChart data={d.timeline} margin={{ left: -20, right: 10 }}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={2} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [v, 'New SOS']} />
              <Area type="monotone" dataKey="count" stroke={SOS_LEVEL.critical} fill={SOS_LEVEL.critical} fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rc-card">
        <h2 className="rc-card-title">Delivery order</h2>
        <div className="table-responsive">
          <table className="rc-table">
            <thead>
              <tr>
                <th>Order</th><th>Barangay</th><th>Level</th><th>Households</th><th>People</th>
                <th>Longest wait</th><th>Score</th><th>Why</th><th />
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 && <tr><td colSpan={9} className="text-secondary">No active SOS.</td></tr>}
              {ranking.map((r) => (
                <tr key={r.id}>
                  <td className="fw-bold">#{r.rank}</td>
                  <td className="fw-semibold">{r.name}</td>
                  <td><span className={`rc-prio ${r.level}`}>{r.level}</span></td>
                  <td>{r.sos_count}</td>
                  <td>{r.people}</td>
                  <td>{waiting(r.waiting_minutes)}</td>
                  <td className="fw-bold">{r.score}</td>
                  <td className="small text-secondary" style={{ minWidth: 200 }}>{r.reason ?? '—'}</td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-light" onClick={() => serve(r)}>Mark as served</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showRules && (
        <Modal title="How the ranking works" onClose={() => setShowRules(false)}>
          <p className="small text-secondary">
            Every SOS means one household needs relief goods. The AI scores each barangay from 0 to 100 using:
          </p>
          <table className="rc-rules">
            <tbody>
              <tr><td>People affected (household sizes)</td><td>Most weight</td></tr>
              <tr><td>Share of registered households asking</td><td>Most weight</td></tr>
              <tr><td>Longest time someone has waited</td><td>Then this</td></tr>
              <tr><td>New SOS in the last hour</td><td>Then this</td></tr>
            </tbody>
          </table>
          <p className="small text-secondary mt-3 mb-0">
            This is separate from Aid Prioritization, which ranks <b>households</b> by seniors, PWDs and so on.
            Each resident has one active SOS, so pressing the button again does not raise the score.
            If the AI is not connected, a standard formula (household size and waiting time) ranks the barangays instead.
          </p>
        </Modal>
      )}
      {confirmDialog}
    </>
  )
}
