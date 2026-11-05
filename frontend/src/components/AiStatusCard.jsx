import { useEffect, useState } from 'react'
import { Bot, CircleCheck, CircleAlert, Loader2, PlugZap, Server } from 'lucide-react'
import api, { errorMessage } from '../api/client'
import useLiveTick from './useLiveTick'

const MODE = {
  ai: { label: 'AI active', cls: 'text-bg-success' },
  degraded: { label: 'AI not answering', cls: 'text-bg-warning' },
  rules: { label: 'Rule-based engine', cls: 'text-bg-secondary' },
}
const num = (n) => (n ?? 0).toLocaleString()
const since = (iso) => {
  if (!iso) return 'never'
  const min = Math.round((Date.now() - new Date(iso)) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h} h ago` : new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function Meter({ used, limit }) {
  if (!limit) return null
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const tone = pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-warning' : 'bg-success'
  return (
    <div className="progress mt-1" style={{ height: 6 }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-bar ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/**
 * LGU: is the AI working, how much of today's budget is left, the last error, and is the queue worker running.
 * Google doesn't report remaining free quota, so the counts are ReliefConnect's own, against the .env budget.
 */
export default function AiStatusCard() {
  const [s, setS] = useState(null)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState(null)
  const [error, setError] = useState('')

  const load = () => api.get('/admin/ai-status').then((r) => { setS(r.data); setError('') })
    .catch((e) => setError(errorMessage(e)))
  useEffect(() => { load() }, [])
  const tick = useLiveTick()
  useEffect(() => { if (tick) load() }, [tick])

  const runTest = async () => {
    setTesting(true); setTest(null)
    try {
      const r = await api.post('/admin/ai-status/test')
      setTest(r.data)
    } catch (e) {
      setTest({ ok: false, message: errorMessage(e) })
    } finally {
      setTesting(false); load()
    }
  }

  if (error && !s) return <section className="rc-card mb-3 small text-danger">AI status: {error}</section>
  if (!s) return null

  const mode = MODE[s.mode]
  const w = s.worker
  const workerProblem = s.blocked !== 'no_key' && !w.running

  return (
    <section className="rc-card mb-3" aria-label="AI status">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <Bot size={18} className="text-secondary" />
        <h2 className="rc-card-title mb-0">AI status</h2>
        <span className={`badge ${mode.cls}`}>{mode.label}</span>
        <span className="small text-secondary">
          {s.models.main}{s.models.backup ? ` · backup ${s.models.backup}` : ''}
        </span>
        <button type="button" className="btn btn-sm btn-rc-outline ms-auto d-flex align-items-center gap-1"
                onClick={runTest} disabled={testing || s.blocked === 'no_key'}>
          {testing ? <Loader2 size={14} className="rc-spin" /> : <PlugZap size={14} />}
          {testing ? 'Testing…' : 'Test connection'}
        </button>
      </div>

      {s.reason && <div className={`alert ${s.mode === 'degraded' ? 'alert-warning' : 'alert-light border'} py-2 small mb-2`}>{s.reason}</div>}
      {workerProblem && (
        <div className="alert alert-danger py-2 small mb-2">
          <b>The queue worker isn’t running</b>, so new SOS messages wait for the AI
          {w.queued_sos > 0 && <> ({w.queued_sos} waiting now)</>}. They still count using the rule-based score.
          Start it in the backend terminal: <code>php artisan queue:work --queue=sos,default</code>
        </div>
      )}

      <div className="row g-3">
        <div className="col-6 col-lg-3">
          <div className="rc-label">AI requests today</div>
          <div className="fw-bold fs-5">
            {num(s.today.requests)}{s.budget.requests ? <span className="fs-6 text-secondary"> / {num(s.budget.requests)}</span> : null}
          </div>
          <Meter used={s.today.requests} limit={s.budget.requests} />
          <div className="small text-secondary mt-1">
            {s.budget.requests_left !== null ? `${num(s.budget.requests_left)} left today` : 'No daily limit set'}
            {s.today.failed > 0 && ` · ${num(s.today.failed)} failed`}
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="rc-label">Tokens used today</div>
          <div className="fw-bold fs-5">
            {num(s.today.tokens)}{s.budget.tokens ? <span className="fs-6 text-secondary"> / {num(s.budget.tokens)}</span> : null}
          </div>
          <Meter used={s.today.tokens} limit={s.budget.tokens} />
          <div className="small text-secondary mt-1">
            {s.budget.tokens_left !== null ? `${num(s.budget.tokens_left)} left today` : `${num(s.today.prompt_tokens)} in · ${num(s.today.output_tokens)} out`}
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="rc-label">AI response time</div>
          <div className="fw-bold fs-5">{s.today.avg_ms !== null ? `${(s.today.avg_ms / 1000).toFixed(1)} s` : '—'}</div>
          <div className="small text-secondary mt-1">Last answer {since(s.last_success_at)}</div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="rc-label">Queue worker</div>
          <div className={`fw-bold fs-5 d-flex align-items-center gap-1 ${w.running ? 'text-success' : 'text-danger'}`}>
            <Server size={16} /> {w.running ? 'Running' : 'Not running'}
          </div>
          <div className="small text-secondary mt-1">
            {w.queued_sos > 0 ? `${w.queued_sos} SOS waiting` : 'No SOS waiting'}
            {w.last_seen_at && !w.running && ` · last seen ${since(w.last_seen_at)}`}
          </div>
        </div>
      </div>

      {s.last_error && (
        <div className="small text-secondary mt-3">
          <CircleAlert size={13} className="me-1 text-warning" />
          Last problem {since(s.last_error.at)} on {s.last_error.model}
          {s.last_error.http_status ? ` (HTTP ${s.last_error.http_status})` : ''}: {s.last_error.message ?? s.last_error.outcome}
        </div>
      )}

      {test && (
        <div className={`alert ${test.ok ? 'alert-success' : 'alert-warning'} py-2 small mt-3 mb-0`}>
          <div className="d-flex align-items-center gap-1 fw-semibold">
            {test.ok ? <CircleCheck size={14} /> : <CircleAlert size={14} />} {test.message}
            {test.seconds !== undefined && <span className="fw-normal text-secondary"> · {test.seconds} s</span>}
          </div>
          {test.result && <div className="mt-1">Sample scored: <b>{test.result.category}</b>, severity {test.result.severity}/10 — {test.result.reason}</div>}
          {test.attempts?.length > 0 && (
            <ul className="mb-0 mt-1 ps-3">
              {test.attempts.map((a, i) => (
                <li key={i}>{a.model}: {a.outcome}{a.http_status ? ` (HTTP ${a.http_status})` : ''} in {(a.duration_ms / 1000).toFixed(1)} s{a.error ? ` — ${a.error}` : ''}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="small text-secondary mt-3 mb-0">
        Google doesn’t show how much free quota is left, so these are ReliefConnect’s own counts against the daily budget
        set in the backend <code>.env</code> (resets at midnight). When the budget runs out or the AI can’t be reached,
        the rule-based engine scores SOS messages, so nothing stops working.
      </p>
    </section>
  )
}
