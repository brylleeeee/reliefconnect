import { RotateCcw } from 'lucide-react'
import Select from './Select'

/** Local YYYY-MM-DD (toISOString would shift to UTC and can land on the wrong day). */
export const ymd = (d) => d.toLocaleDateString('en-CA')

export const PRESETS = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
  { key: 'custom', label: 'Custom' },
]

/** from/to for a preset; 'custom' keeps whatever dates were typed. */
export function presetRange(key) {
  const today = new Date()
  const back = (days) => { const d = new Date(); d.setDate(d.getDate() - (days - 1)); return d }
  switch (key) {
    case '7d': return { from: ymd(back(7)), to: ymd(today) }
    case '90d': return { from: ymd(back(90)), to: ymd(today) }
    case 'month': return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) }
    case 'year': return { from: ymd(new Date(today.getFullYear(), 0, 1)), to: ymd(today) }
    default: return { from: ymd(back(30)), to: ymd(today) }
  }
}

/** A function, not a constant, so "last 30 days" is still right if the page stays open past midnight. */
export const defaultFilters = () => ({ preset: '30d', ...presetRange('30d'), barangay_id: '', relief_item_id: '' })

/** "Oct 7 – Nov 5, 2026" */
export function periodLabel(from, to) {
  const f = new Date(`${from}T00:00`); const t = new Date(`${to}T00:00`)
  const sameYear = f.getFullYear() === t.getFullYear()
  const a = f.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
  const b = t.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  return from === to ? b : `${a} – ${b}`
}

/**
 * Dashboard filters (panel recommendation): period, barangay, relief item.
 * `options` comes from the analytics response so the lists always match the data.
 */
export default function AnalyticsFilters({ value, onChange, options }) {
  const set = (patch) => onChange({ ...value, ...patch })
  const isDefault = value.preset === '30d' && !value.barangay_id && !value.relief_item_id
  const goods = options?.items.filter((i) => i.type !== 'cash') ?? []
  const cash = options?.items.filter((i) => i.type === 'cash') ?? []

  return (
    <section className="rc-card mb-3 py-3" aria-label="Dashboard filters">
      <div className="row g-2 align-items-end">
        <div className="col-12 col-xl-auto">
          <div className="rc-label">Period</div>
          <div className="rc-chips" role="group" aria-label="Period">
            {PRESETS.map((p) => (
              <button key={p.key} type="button" className="rc-chip" aria-pressed={value.preset === p.key}
                      onClick={() => set(p.key === 'custom' ? { preset: 'custom' } : { preset: p.key, ...presetRange(p.key) })}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {value.preset === 'custom' && (
          <>
            <div className="col-6 col-md-3 col-xl-2">
              <label className="rc-label" htmlFor="af-from">From</label>
              <input id="af-from" type="date" className="form-control form-control-sm" value={value.from} max={value.to}
                     onChange={(e) => e.target.value && set({ from: e.target.value })} />
            </div>
            <div className="col-6 col-md-3 col-xl-2">
              <label className="rc-label" htmlFor="af-to">To</label>
              <input id="af-to" type="date" className="form-control form-control-sm" value={value.to} min={value.from} max={ymd(new Date())}
                     onChange={(e) => e.target.value && set({ to: e.target.value })} />
            </div>
          </>
        )}

        <div className="col-6 col-md-3 col-xl-2">
          <label className="rc-label" htmlFor="af-brgy">Barangay</label>
          <Select id="af-brgy" className="form-select form-select-sm" value={value.barangay_id}
                  onChange={(e) => set({ barangay_id: e.target.value })}>
            <option value="">All barangays</option>
            {options?.barangays.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </div>

        <div className="col-6 col-md-3 col-xl-2">
          <label className="rc-label" htmlFor="af-item">Relief item</label>
          <Select id="af-item" className="form-select form-select-sm" value={value.relief_item_id}
                  onChange={(e) => set({ relief_item_id: e.target.value })}>
            <option value="">All items</option>
            {goods.length > 0 && (
              <optgroup label="Relief goods">
                {goods.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </optgroup>
            )}
            {cash.length > 0 && (
              <optgroup label="Cash aid">
                {cash.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </optgroup>
            )}
          </Select>
        </div>

        {!isDefault && (
          <div className="col-auto">
            <button type="button" className="btn btn-sm btn-light d-flex align-items-center gap-1"
                    onClick={() => onChange(defaultFilters())}>
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
