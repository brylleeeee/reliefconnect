import { useEffect, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Info } from 'lucide-react'
import api from '../api/client'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import useLiveTick from '../components/useLiveTick'
import { C } from '../chartColors'

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

  const changeItem = (id) => load({ relief_item_id: id }) // packs reset to that item's stock
  const recalc = (e) => { e.preventDefault(); load({ relief_item_id: itemId, packs }) }

  if (!data) return <PageHeader title="Aid Prioritization per Barangay" subtitle="Loading…" />

  const rows = data.barangays
  const totalHigh = rows.reduce((s, r) => s + r.high, 0)
  const highCovered = rows.reduce((s, r) => s + r.covered_high, 0)
  const allocated = rows.reduce((s, r) => s + r.allocation, 0)
  const unit = data.selected_item?.unit ?? 'packs'

  return (
    <>
      <PageHeader title="Aid Prioritization per Barangay"
                  subtitle="Priority is computed automatically from household data, so allocation follows the same rules for every barangay" />

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
        <p className="small text-secondary mb-0 ms-auto">
          Defaults to current stock. Change the quantity to plan a smaller release.
        </p>
      </form>

      <div className="row g-3 mb-3">
        <div className="col-md-3"><div className="rc-stat">
          <div className="rc-stat-label">Registered households</div>
          <div className="rc-stat-value">{data.total_households.toLocaleString()}</div>
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

      <section className="rc-card mb-3">
        <div className="d-flex align-items-center gap-2 mb-2">
          <h2 className="rc-card-title mb-0">Households by priority level</h2>
          <button type="button" className="btn btn-link p-0 text-secondary d-inline-flex"
                  onClick={() => setShowScoring(true)}
                  aria-label="How priority is scored" title="How priority is scored">
            <Info size={16} />
          </button>
        </div>
        {/* About 28px per barangay, so all 21 barangays and their labels fit */}
        <div style={{ height: Math.max(280, rows.length * 28 + 70) }}>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ left: 10, right: 20 }} barCategoryGap="25%">
              <CartesianGrid horizontal={false} stroke={C.grid} />
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12 }} interval={0} />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="high" name="High" stackId="p" fill={C.high} />
              <Bar dataKey="medium" name="Medium" stackId="p" fill={C.medium} />
              <Bar dataKey="low" name="Low" stackId="p" fill={C.low} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rc-card">
        <h2 className="rc-card-title">Suggested allocation: {data.selected_item?.name}</h2>
        <div className="table-responsive">
          <table className="rc-table">
            <thead>
              <tr>
                <th>Barangay</th><th>Households</th><th>High / Med / Low</th>
                <th>Seniors</th><th>PWDs</th><th>Infants</th><th>Pregnant</th>
                <th>Suggested {unit}</th><th style={{ minWidth: 160 }}>Coverage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="fw-semibold">{r.name}</td>
                  <td>{r.households}</td>
                  <td>
                    <span className="rc-dot" style={{ background: C.high }} />{r.high}
                    <span className="rc-dot ms-2" style={{ background: C.medium }} />{r.medium}
                    <span className="rc-dot ms-2" style={{ background: C.low }} />{r.low}
                  </td>
                  <td>{r.seniors}</td><td>{r.pwd}</td><td>{r.infants}</td><td>{r.pregnant}</td>
                  <td className="fw-bold">{r.allocation.toLocaleString()}</td>
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
          </p>
        </Modal>
      )}
    </>
  )
}
