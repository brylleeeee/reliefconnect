import { useEffect, useState } from 'react'
import { Users, Box, ClipboardList, Wallet, HandHeart, FileDown, FileSpreadsheet, FileText, ShieldCheck, Eye } from 'lucide-react'
import api, { downloadFile, errorMessage } from '../api/client'
import PageHeader from '../components/PageHeader'
import { exportExcel } from '../lib/exportExcel'
import useLiveTick from '../components/useLiveTick'

const REPORTS = [
  { type: 'distribution', title: 'Distribution', icon: ClipboardList, byEvent: true,
    desc: 'Every relief goods claim: household, item, how it was verified, and who released it.' },
  { type: 'inventory', title: 'Inventory', icon: Box,
    desc: 'Relief goods received and released in the period, reserved for events, in stock and available.' },
  { type: 'cash', title: 'Cash aid', icon: Wallet, byEvent: true,
    desc: 'Where the money is: fund balance, amount reserved for events, received, and every peso released.' },
  { type: 'sources', title: 'Sources of relief', icon: HandHeart,
    desc: 'Where relief came from and when: donations, LGU funds and government allocations.' },
  { type: 'beneficiary', title: 'Beneficiaries', icon: Users,
    desc: 'Approved households with members, seniors, PWDs, infants, pregnant members and priority level.' },
]

const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
const monthStart = today.slice(0, 8) + '01'
const PAGE = 25

export default function Reports() {
  const [type, setType] = useState('distribution')
  const [range, setRange] = useState({ from: monthStart, to: today })
  const [eventId, setEventId] = useState('')
  const [events, setEvents] = useState([])
  const [report, setReport] = useState(null)
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const meta = REPORTS.find((r) => r.type === type)
  const params = { ...range, event_id: meta.byEvent && eventId ? eventId : undefined }

  useEffect(() => { api.get('/admin/events').then((r) => setEvents(r.data.events.data)) }, [])

  const preview = async () => {
    setBusy('preview'); setError('')
    try {
      const r = await api.get(`/admin/reports/${type}`, { params: { ...params, format: 'json' } })
      setReport(r.data); setPage(1)
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy('') }
  }
  // Refresh the preview whenever the report or its filters change
  useEffect(() => { preview() }, [type, range.from, range.to, eventId])

  // Live: refresh the preview in place, keeping the current page
  const tick = useLiveTick()
  useEffect(() => {
    if (!tick || busy) return
    api.get(`/admin/reports/${type}`, { params: { ...params, format: 'json' } }).then((r) => {
      setReport(r.data)
      setPage((pg) => Math.min(pg, Math.max(1, Math.ceil(r.data.rows.length / PAGE))))
    }).catch(() => {})
  }, [tick])

  const download = async (format) => {
    setBusy(format); setError('')
    try {
      if (format === 'xlsx') await exportExcel(report)
      else await downloadFile(`/admin/reports/${type}`, { ...params, format })
    } catch (err) {
      // Blob responses hide the JSON error; read it back out
      if (err.response?.data instanceof Blob) {
        try { err.response.data = JSON.parse(await err.response.data.text()) } catch { /* not JSON */ }
      }
      setError(errorMessage(err))
    } finally { setBusy('') }
  }

  const rows = report?.rows ?? []
  const shown = rows.slice((page - 1) * PAGE, page * PAGE)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const eventsForType = events.filter((e) => (type === 'cash' ? e.item.unit === 'PHP' : e.item.unit !== 'PHP'))

  return (
    <>
      <PageHeader title="Reports" subtitle="Preview and export official records as PDF, Excel or CSV" />

      <div className="row g-3">
        <div className="col-lg-3">
          <div className="d-flex flex-column gap-2" role="tablist" aria-label="Report type">
            {REPORTS.map(({ type: t, title, icon: Icon, desc }) => (
              <button key={t} role="tab" aria-selected={type === t} className={`rc-report-type ${type === t ? 'active' : ''}`}
                      onClick={() => { setType(t); setEventId(''); setReport(null) }}>
                <div className="fw-semibold d-flex align-items-center gap-2"><Icon size={15} /> {title}</div>
                <div className="small text-secondary">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="col-lg-9">
          <section className="rc-card mb-3">
            <div className="row g-2 align-items-end">
              <div className="col-sm-3">
                <label className="rc-label" htmlFor="rep-from">From</label>
                <input id="rep-from" type="date" className="form-control" value={range.from} max={range.to}
                       onChange={(e) => setRange({ ...range, from: e.target.value })} />
              </div>
              <div className="col-sm-3">
                <label className="rc-label" htmlFor="rep-to">To</label>
                <input id="rep-to" type="date" className="form-control" value={range.to} min={range.from}
                       onChange={(e) => setRange({ ...range, to: e.target.value })} />
              </div>
              {meta.byEvent && (
                <div className="col-sm-6">
                  <label className="rc-label" htmlFor="rep-event">Distribution event</label>
                  <select id="rep-event" className="form-select" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                    <option value="">All events</option>
                    {eventsForType.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="d-flex flex-wrap gap-2 mt-3">
              <button className="btn btn-rc d-flex align-items-center gap-2" disabled={!report || !!busy} onClick={() => download('pdf')}>
                <FileText size={15} /> {busy === 'pdf' ? 'Preparing…' : 'Export PDF'}
              </button>
              <button className="btn btn-rc-outline d-flex align-items-center gap-2" disabled={!report || !!busy} onClick={() => download('xlsx')}>
                <FileSpreadsheet size={15} /> {busy === 'xlsx' ? 'Preparing…' : 'Export Excel'}
              </button>
              <button className="btn btn-rc-outline d-flex align-items-center gap-2" disabled={!report || !!busy} onClick={() => download('csv')}>
                <FileDown size={15} /> {busy === 'csv' ? 'Preparing…' : 'Export CSV'}
              </button>
            </div>
          </section>

          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <section className="rc-card">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h2 className="rc-card-title mb-0 d-flex align-items-center gap-2"><Eye size={16} /> {report?.title ?? meta.title}</h2>
              {report && <span className="small text-secondary">{rows.length.toLocaleString()} record{rows.length === 1 ? '' : 's'}</span>}
            </div>
            {busy === 'preview' && !report && <p className="text-secondary small">Loading…</p>}

            {report && (
              <>
                <div className="row g-2 mb-3">
                  {Object.entries(report.summary ?? {}).map(([label, value]) => (
                    <div className="col-6 col-md-3" key={label}>
                      <div className="rc-stat h-100">
                        <div className="rc-stat-label">{label}</div>
                        <div className="fw-bold">{value}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="table-responsive">
                  <table className="rc-table rc-table-compact">
                    <thead><tr>{report.headers.map((h) => <th key={h} className="text-nowrap">{h}</th>)}</tr></thead>
                    <tbody>
                      {shown.map((row, i) => (
                        <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                      ))}
                      {rows.length === 0 && (
                        <tr><td colSpan={report.headers.length} className="text-center muted py-4">No records in this period.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {pages > 1 && (
                  <div className="d-flex justify-content-between align-items-center mt-2 small">
                    <span>Showing {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, rows.length)} of {rows.length}</span>
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-rc-outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
                      <button className="btn btn-sm btn-rc-outline" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <div className="rc-compliance mt-3">
            <h3><ShieldCheck size={16} /> Data privacy</h3>
            <p className="small text-secondary mb-0">
              Reports contain personal information of registered households. Store and share exported files
              only with authorized personnel, in line with RA 10173 (Data Privacy Act of 2012).
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
