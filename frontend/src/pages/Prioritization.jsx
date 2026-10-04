import { useEffect, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Info, Siren, Sparkles } from 'lucide-react'
import api from '../api/client'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import useLiveTick from '../components/useLiveTick'
import { C, SOS_LEVEL } from '../chartColors'

const FILTERS = [
  { key: 'all', label: 'All barangays' },
  { key: 'sos', label: 'Needs priority (has SOS)' },
  { key: 'urgent', label: 'Critical and high only' },
  { key: 'none', label: 'No SOS' },
]
const waiting = (min) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`)

const WEIGHT_LABELS = {
  senior: 'Each senior citizen (60+)',
  pwd: 'Each person with disability',
  pregnant: 'Each pregnant member',
  infant: 'Each infant (0–1 yr)',
  solo_parent: 'Solo parent household',
  large_household: 'Household of 6 or more',
}

function CoverageBar({ row }) {
  const pct = (n) => (row.households ? (n / row.households) * 100 : 0)
  return (
    <div className="rc-coverage" title={`${row.allocation} of ${row.households} households`}>
      <span style={{ width: `${pct(row.covered_high)}%`, background: C.high }} />
      <span style={{ width: `${pct(row.covered_medium)}%`, background: C.medium }} />
      <span style={{ width: `${pct(row.covered_low)}%`, background: C.low }} />
    </div>
  )
}

export default function Prioritization() {
  const [data, setData] = useState(null)
  const [itemId, setItemId] = useState('')
  const [packs, setPacks] = useState('')
  const [showScoring, setShowScoring] = useState(false)
  const [filter, setFilter] = useState('all')      // which barangays to show
  const [sort, setSort] = useState('priority')     // priority order or A-Z
  const [mode, setMode] = useState('share')        // share by priority, or serve SOS barangays first

  const applied = useRef({}) // the item and quantity last calculated

  const load = (params = {}) => {
    applied.current = params
    return api.get('/admin/prioritization', { params }).then((r) => {
      setData(r.data)
      setItemId(r.data.selected_item?.id ?? '')
      setPacks(r.data.packs)
    })
  }

  useEffect(() => { load() }, [])

  // Live: recalculate with the same item and quantity, without touching what's being typed
  const tick = useLiveTick()
  useEffect(() => {
    if (tick) api.get('/admin/prioritization', { params: applied.current }).then((r) => setData(r.data))
  }, [tick])

  const changeItem = (id) => load({ relief_item_id: id, mode }) // packs reset to that item's stock
  const recalc = (e) => { e.preventDefault(); load({ relief_item_id: itemId, packs, mode }) }
  const changeMode = (m) => { setMode(m); load({ relief_item_id: itemId, packs, mode: m }) }

  if (!data) return <PageHeader title="Aid Prioritization per Barangay" subtitle="Loading…" />

  const all = data.barangays
  const rank = (r) => r.sos_priority?.rank ?? 999
  const rows = all
    .filter((r) => filter === 'all'
      || (filter === 'sos' && r.sos > 0)
      || (filter === 'urgent' && ['critical', 'high'].includes(r.sos_priority?.level))
      || (filter === 'none' && r.sos === 0))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name)
      : rank(a) - rank(b) || b.high - a.high || a.name.localeCompare(b.name)))
  const firstUp = all.filter((r) => r.sos_priority).sort((a, b) => rank(a) - rank(b))
  const totalHigh = all.reduce((s, r) => s + r.high, 0)
  const highCovered = all.reduce((s, r) => s + r.covered_high, 0)
  const allocated = all.reduce((s, r) => s + r.allocation, 0)
  const sosTotal = all.reduce((s, r) => s + r.sos, 0)
  const unit = data.selected_item?.unit ?? 'packs'

  return (
    <>
      <PageHeader title="Aid Prioritization per Barangay"
                  subtitle="Priority is computed automatically from household data and active SOS, so allocation follows the same rules for every barangay" />

      <form className="rc-card mb-3 d-flex flex-wrap gap-3 align-items-end" onSubmit={recalc}>
        <div style={{ minWidth: 260 }}>
          <label className="rc-label" htmlFor="item">Relief item to allocate</label>
          <select id="item" className="form-select" value={itemId} onChange={(e) => changeItem(e.target.value)}>
            {data.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <div style={{ width: 160 }}>
          <label className="rc-label" htmlFor="packs">Quantity available</label>
          <input id="packs" type="number" min="0" className="form-control" value={packs}
                 onChange={(e) => setPacks(e.target.value)} />
        </div>
        <button className="btn btn-rc">Recalculate</button>
        <div>
          <span className="rc-label d-block">Allocation</span>
          <div className="btn-group" role="group" aria-label="How to allocate">
            <button type="button" className={`btn btn-sm ${mode === 'share' ? 'btn-rc' : 'btn-rc-outline'}`}
                    onClick={() => changeMode('share')}>Share by priority</button>
            <button type="button" className={`btn btn-sm ${mode === 'sos_first' ? 'btn-rc' : 'btn-rc-outline'}`}
                    onClick={() => changeMode('sos_first')}>Serve SOS barangays first</button>
          </div>
        </div>
        <p className="small text-secondary mb-0 ms-auto" style={{ maxWidth: 300 }}>
          {mode === 'sos_first'
            ? 'Barangays with SOS get one for every household that asked, in priority order, before the rest is shared.'
            : 'Defaults to current stock. Active SOS add to a barangay\'s share, more for urgent messages.'}
        </p>
      </form>

      <section className="rc-card mb-3 rc-sos-first">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <h2 className="rc-card-title mb-0 d-flex align-items-center gap-2"><Siren size={17} className="text-danger" /> Barangays to prioritize first</h2>
          <span className="small text-secondary d-inline-flex align-items-center gap-1 ms-auto">
            <Sparkles size={13} />
            {data.engine === 'rules'
              ? 'Ranked by ReliefConnect\'s built-in scoring of SOS messages (no AI key needed)'
              : data.engine === 'ai' ? 'Ranked with AI scoring of SOS messages' : 'Ranked with AI and built-in scoring of SOS messages'}
          </span>
        </div>
        {firstUp.length === 0 ? (
          <p className="small text-secondary mb-0">No active SOS. Allocation follows household priority only.</p>
        ) : (
          <div className="rc-first-list">
            {firstUp.map((r) => (
              <div key={r.id} className={`rc-first ${r.sos_priority.level}`}>
                <div className="rc-first-rank">#{r.sos_priority.rank}</div>
                <div className="flex-grow-1 min-w-0">
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="fw-semibold">{r.name}</span>
                    <span className={`rc-prio ${r.sos_priority.level}`}>{r.sos_priority.level}</span>
                  </div>
                  <div className="small text-secondary">
                    {r.sos} SOS · {r.sos_priority.people} people · waiting {waiting(r.sos_priority.waiting_minutes)}
                  </div>
                  {r.sos_priority.reason && <div className="small mt-1">{r.sos_priority.reason}</div>}
                </div>
                <div className="text-end text-nowrap">
                  <div className="fw-bold">{r.allocation.toLocaleString()}</div>
                  <div className="small text-secondary">{unit}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="row g-3 mb-3">
        <div className="col-md-3"><div className="rc-stat">
          <div className="rc-stat-label">Barangays needing priority</div>
          <div className={`rc-stat-value ${firstUp.length ? 'danger' : ''}`}>{firstUp.length}</div>
          <div className="small text-secondary">{sosTotal} active SOS · {data.total_households.toLocaleString()} households</div>
        </div></div>
        <div className="col-md-3"><div className="rc-stat">
          <div className="rc-stat-label">High priority households</div>
          <div className="rc-stat-value danger">{totalHigh.toLocaleString()}</div>
        </div></div>
        <div className="col-md-3"><div className="rc-stat">
          <div className="rc-stat-label">{unit} allocated</div>
          <div className="rc-stat-value green">{allocated.toLocaleString()}</div>
        </div></div>
        <div className="col-md-3"><div className="rc-stat">
          <div className="rc-stat-label">High priority covered</div>
          <div className={`rc-stat-value ${highCovered < totalHigh ? 'danger' : 'green'}`}>
            {totalHigh ? Math.round((highCovered / totalHigh) * 100) : 100}%
          </div>
        </div></div>
      </div>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <div className="rc-tabs mb-0" role="tablist" aria-label="Filter barangays">
          {FILTERS.map((f) => (
            <button key={f.key} role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'active' : ''}
                    onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <select className="form-select form-select-sm ms-auto" style={{ width: 'auto' }} aria-label="Sort barangays"
                value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="priority">Sort: priority order</option>
          <option value="name">Sort: barangay A–Z</option>
        </select>
      </div>

      <section className="rc-card mb-3">
        <div className="d-flex align-items-center gap-2 mb-2">
          <h2 className="rc-card-title mb-0">Households by priority level</h2>
          <button type="button" className="btn btn-link p-0 text-secondary d-inline-flex"
                  onClick={() => setShowScoring(true)}
                  aria-label="How priority is scored" title="How priority is scored">
            <Info size={16} />
          </button>
        </div>
        {rows.length === 0 && <p className="small text-secondary mb-0">No barangays match this filter.</p>}
        {/* About 28px per barangay, so all 21 barangays and their labels fit */}
        {rows.length > 0 && <div style={{ height: Math.max(200, rows.length * 28 + 70) }}>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ left: 10, right: 20 }} barCategoryGap="25%">
              <CartesianGrid horizontal={false} stroke={C.grid} />
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12 }} interval={0} />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="high" name="High" stackId="p" fill={C.high} />
              <Bar dataKey="medium" name="Medium" stackId="p" fill={C.medium} />
              <Bar dataKey="low" name="Low" stackId="p" fill={C.low} />
              <Bar dataKey="sos" name="Active SOS" stackId="p" fill={SOS_LEVEL.critical} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>}
      </section>

      <section className="rc-card">
        <h2 className="rc-card-title">Suggested allocation: {data.selected_item?.name}</h2>
        <div className="table-responsive">
          <table className="rc-table">
            <thead>
              <tr>
                <th>Priority</th><th>Barangay</th><th>Households</th><th>High / Med / Low</th><th>Active SOS</th>
                <th>Seniors</th><th>PWDs</th><th>Infants</th><th>Pregnant</th>
                <th>Suggested {unit}</th><th style={{ minWidth: 160 }}>Coverage</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={11} className="text-center muted py-3">No barangays match this filter.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className={r.sos_priority ? `rc-row-sos ${r.sos_priority.level}` : ''}>
                  <td className="text-nowrap">
                    {r.sos_priority
                      ? <><b>#{r.sos_priority.rank}</b> <span className={`rc-prio ${r.sos_priority.level}`}>{r.sos_priority.level}</span></>
                      : <span className="text-secondary small">—</span>}
                  </td>
                  <td className="fw-semibold">{r.name}</td>
                  <td>{r.households}</td>
                  <td>
                    <span className="rc-dot" style={{ background: C.high }} />{r.high}
                    <span className="rc-dot ms-2" style={{ background: C.medium }} />{r.medium}
                    <span className="rc-dot ms-2" style={{ background: C.low }} />{r.low}
                  </td>
                  <td title={r.sos_priority?.reason ?? 'Residents in this barangay who pressed SOS and are waiting for relief goods'}>
                    {r.sos ? <span className="text-danger fw-semibold">{r.sos} <span className="small">(+{r.sos_points})</span></span> : <span className="text-secondary">—</span>}
                  </td>
                  <td>{r.seniors}</td><td>{r.pwd}</td><td>{r.infants}</td><td>{r.pregnant}</td>
                  <td className="fw-bold">
                    {r.allocation.toLocaleString()}
                    {r.sos_first_packs > 0 && <div className="small text-secondary fw-normal">{r.sos_first_packs} for SOS first</div>}
                  </td>
                  <td>
                    <CoverageBar row={r} />
                    <div className="small text-secondary mt-1">
                      {r.coverage_pct}% of households
                      {r.covered_high < r.high && <span className="text-danger"> · {r.high - r.covered_high} high priority not covered</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showScoring && (
        <Modal title="How priority is scored" onClose={() => setShowScoring(false)}>
          <table className="rc-rules">
            <tbody>
              {Object.entries(data.rules.priority_weights).map(([k, v]) => (
                <tr key={k}><td>{WEIGHT_LABELS[k] ?? k}</td><td>+{v}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="small text-secondary mt-3 mb-0">
            Score {data.rules.priority_levels.high}+ is <b>high</b>, {data.rules.priority_levels.medium}–{data.rules.priority_levels.high - 1} is <b>medium</b>, below that is <b>low</b>.
            Each barangay's share is weighted {data.rules.allocation_weights.high}:{data.rules.allocation_weights.medium}:{data.rules.allocation_weights.low} by
            level, capped at one {unit.toLowerCase().replace(/s$/, '')} per household, and released high priority first.
            Each active SOS from an approved household adds +{data.rules.sos_points} to its barangay's share, plus up to
            +{data.rules.sos_message_points} more when the message is urgent (people trapped, injured, flooding), so barangays
            asking for help receive more. <b>Barangays to prioritize first</b> are ranked by people affected, waiting time,
            how serious the SOS messages are, and how vulnerable the households are.
          </p>
        </Modal>
      )}
    </>
  )
}
