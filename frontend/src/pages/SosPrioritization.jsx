import { useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Info, Sparkles, TriangleAlert } from 'lucide-react'
import api, { errorMessage } from '../api/client'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import useLiveTick, { useLiveUpdatedAt } from '../components/useLiveTick'
import { C, SOS_LEVEL } from '../chartColors'

const MSG_COLOR = '#7c3aed'
const AID_COLOR = '#0d9488'

const waiting = (min) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`)
const pretty = (t) => { const s = String(t).replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1) }

// Hover tooltip for the priority graph: shows how the score was made and the reason
function ScoreTip({ active, payload, msgLabel }) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, fontSize: 12, maxWidth: 260 }}>
      <b>{r.name}</b> <span className={`rc-prio ${r.level}`}>{r.level}</span>
      <div>Score {r.score} (base {r.base_score ?? '-'} + {msgLabel} {r.ai_points ?? 0} + aid {r.vulnerability_points ?? 0})</div>
      {r.reason && <div className="text-secondary mt-1">{r.reason}</div>}
    </div>
  )
}

// One horizontal bar graph card. Bars (and optional Cells) are passed as children.
function BarCard({ title, action, data, tooltip, legend, decimals = false, empty = 'No active SOS.', children }) {
  return (
    <section className="col-lg-6">
      <div className="rc-card h-100">
        <div className="d-flex align-items-center gap-2 mb-2">
          <h2 className="rc-card-title mb-0">{title}</h2>
          {action}
        </div>
        {data.length === 0 ? <p className="text-secondary small">{empty}</p> : (
          <div style={{ height: Math.max(240, data.length * 34 + 60) }}>
            <ResponsiveContainer>
              <BarChart data={data} layout="vertical" margin={{ left: 10, right: 24 }} barCategoryGap="25%">
                <CartesianGrid horizontal={false} stroke={C.grid} />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={decimals} />
                <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12 }} interval={0} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} {...(tooltip ? { content: tooltip } : {})} />
                {legend && <Legend wrapperStyle={{ fontSize: 12 }} />}
                {children}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  )
}

export default function SosPrioritization() {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [showRules, setShowRules] = useState(false)

  const load = () => api.get('/admin/sos').then((r) => { setD(r.data); setError('') })
    .catch((e) => { if (!d) setError(errorMessage(e)) })

  useEffect(() => { load() }, [])
  // Live: new SOS from the mobile app appear and re-rank without reloading
  const tick = useLiveTick()
  useEffect(() => { if (tick) load() }, [tick])
  const updatedAt = useLiveUpdatedAt()

  if (error) return <><PageHeader title="SOS Prioritization" subtitle="" /><div className="alert alert-danger">{error}</div></>
  if (!d) return <PageHeader title="SOS Prioritization" subtitle="Loading…" />

  const { summary: s, top, ranking } = d

  // 'rules' = no AI API key yet, so the rule-based engine scores the SOS messages.
  // Once GEMINI_API_KEY is set in the backend .env, the AI scores them and the wording switches to AI.
  const aiOn = d.engine === 'ai' || d.engine === 'mixed'
  const engineName = aiOn ? 'AI' : 'rule-based engine'
  const msgLabel = aiOn ? 'AI points' : 'message points'
  const banner = d.engine === 'ai'
    ? 'Ranked by AI from the residents\' SOS messages.'
    : d.engine === 'mixed'
      ? 'Ranked by AI and the rule-based engine from the residents\' SOS messages.'
      : 'Ranked by ReliefConnect\'s rule-based engine from the residents\' SOS messages. AI scoring will work once an AI API key is added.'

  const waitData = ranking.map((r) => ({ name: r.name, hours: Math.round((r.waiting_minutes / 60) * 10) / 10 }))
  const typeData = (d.charts?.emergency_types?.labels ?? []).map((t, i) => ({
    name: pretty(t), total: d.charts.emergency_types.data[i],
  }))

  return (
    <>
      <PageHeader
        title="SOS Prioritization"
        subtitle="Residents press SOS and describe what is happening. Each message adds points to the household, and the barangay with the most urgent need is ranked first"
        actions={<span className="rc-live">Live · updated {updatedAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</span>}
      />

      <div className="small mb-3 d-flex align-items-center gap-2 text-success">
        <Sparkles size={14} />
        {banner}
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
            {top.ai_points > 0 && <> The {engineName} added {top.ai_points} points from their messages.</>}
            {top.high_priority_households > 0 && <> {top.high_priority_households} of the households are high priority in Aid Prioritization.</>}
            {top.reason && <> <b>Why:</b> {top.reason}</>}
          </div>
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
          <div className="rc-stat-label">{aiOn ? 'AI points added' : 'Message points added'}</div>
          <div className="rc-stat-value green">{s.ai_points ?? 0}</div>
        </div></div>
      </div>

      <div className="row g-3">
        <BarCard
          title="Priority score per barangay"
          data={ranking}
          tooltip={<ScoreTip msgLabel={msgLabel} />}
          decimals
          action={(
            <button type="button" className="btn btn-link p-0 text-secondary d-inline-flex"
                    onClick={() => setShowRules(true)} aria-label="How the ranking works" title="How the ranking works">
              <Info size={16} />
            </button>
          )}
        >
          <Bar dataKey="score" radius={[0, 4, 4, 0]}>
            {ranking.map((r) => <Cell key={r.id} fill={SOS_LEVEL[r.level]} />)}
          </Bar>
        </BarCard>

        <BarCard title="Where the score comes from" data={ranking} legend decimals>
          <Bar dataKey="base_score" name="Base score (people, waiting)" stackId="score" fill={C.blue} />
          <Bar dataKey="ai_points" name={`${aiOn ? 'AI points' : 'Message points'} (from SOS messages)`} stackId="score" fill={MSG_COLOR} />
          <Bar dataKey="vulnerability_points" name="Aid priority (vulnerable households)" stackId="score" fill={AID_COLOR} radius={[0, 4, 4, 0]} />
        </BarCard>

        <BarCard title="Households and people asking, per barangay" data={ranking} legend>
          <Bar dataKey="sos_count" name="Households (SOS)" fill={C.high} radius={[0, 4, 4, 0]} />
          <Bar dataKey="people" name="People" fill={C.blue} radius={[0, 4, 4, 0]} />
        </BarCard>

        <BarCard title="Longest wait (hours)" data={waitData} decimals>
          <Bar dataKey="hours" name="Hours" fill={C.high} radius={[0, 4, 4, 0]} />
        </BarCard>

        <BarCard title="What residents reported" data={typeData} empty="No SOS messages read yet.">
          <Bar dataKey="total" name="SOS" fill={MSG_COLOR} radius={[0, 4, 4, 0]} />
        </BarCard>
      </div>

      {showRules && (
        <Modal title="How the ranking works" onClose={() => setShowRules(false)}>
          <p className="small text-secondary">
            Every SOS means one household needs relief goods. When a resident presses SOS and writes a message
            (for example "baha na kami"), the {aiOn ? 'AI' : 'rule-based engine'} reads it and adds points to that household:
          </p>
          <table className="rc-rules">
            <tbody>
              <tr><td>How serious the situation sounds</td><td>Most points</td></tr>
              <tr><td>Trapped or injured people</td><td>Extra points</td></tr>
              <tr><td>Children, seniors or pregnant members</td><td>Extra points</td></tr>
              <tr><td>No food or water</td><td>Extra points</td></tr>
              <tr><td>Household is high or medium priority in Aid Prioritization</td><td>Extra points</td></tr>
            </tbody>
          </table>
          <p className="small text-secondary mt-3 mb-0">
            A barangay's score = a base score (people affected and how long they have waited) + the message points of all
            its households + extra points for households that Aid Prioritization marks as high or medium priority (seniors,
            PWDs, infants and so on). The highest score is served first. A barangay drops out of the ranking when its delivery
            is recorded. Aid Prioritization ranks <b>households</b>, and its result feeds into this score.
            Each resident has one active SOS, so pressing the button again does not raise the score.
          </p>
          <p className="small text-secondary mt-2 mb-0">
            {aiOn
              ? 'The AI reads each message. If the AI is busy, the rule-based engine still gives points, so no SOS is left unscored.'
              : 'For now, the rule-based engine reads each message using keywords in English, Filipino, Ilocano and Pangasinan (for example baha, naipit, lagnat, walang pagkain). AI scoring will work once an AI API key is added, and the rule-based engine will remain as its backup.'}
          </p>
        </Modal>
      )}
    </>
  )
}