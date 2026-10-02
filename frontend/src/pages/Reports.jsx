import { useState } from 'react'
import { Users, Box, ClipboardList, CloudDownload, ShieldCheck } from 'lucide-react'
import { downloadFile, errorMessage } from '../api/client'
import PageHeader from '../components/PageHeader'

const reports = [
  { type: 'beneficiary', title: 'Beneficiary Report', icon: Users,
    desc: 'Generates a demographic profile of registered households, vulnerable group counts (seniors, infants, PWDs), and geographic distribution across puroks.' },
  { type: 'inventory', title: 'Inventory Report', icon: Box,
    desc: 'Generates a detailed summary of incoming donation packs, current stock levels, low-stock warnings, and expiring relief goods ledger.' },
  { type: 'distribution', title: 'Distribution Report', icon: ClipboardList,
    desc: 'Generates a log of distribution events, total relief packs claimed, successful scanned QR codes, pending claims, and active staff details.' },
]

const today = new Date().toISOString().slice(0, 10)
const monthStart = today.slice(0, 8) + '01'

function ReportCard({ type, title, icon: Icon, desc }) {
  const [range, setRange] = useState({ from: monthStart, to: today })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    setBusy(true); setError('')
    try {
      await downloadFile(`/admin/reports/${type}`, { ...range, format: 'csv' })
      await downloadFile(`/admin/reports/${type}`, { ...range, format: 'pdf' })
    } catch (err) {
      // Blob responses hide the JSON error; read it back out
      if (err.response?.data instanceof Blob) {
        try { err.response.data = JSON.parse(await err.response.data.text()) } catch { /* not JSON */ }
      }
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rc-card h-100 d-flex flex-column">
      <div className="d-flex gap-3 align-items-center mb-3">
        <span className="rc-report-icon"><Icon size={18} /></span>
        <div>
          <div className="fw-bold">{title}</div>
          <div className="rc-report-kicker">Official Barangay Export</div>
        </div>
      </div>
      <p className="small text-secondary">{desc}</p>

      <label className="rc-label" htmlFor={`${type}-from`}>From date</label>
      <input id={`${type}-from`} type="date" className="form-control mb-2" value={range.from}
             onChange={(e) => setRange({ ...range, from: e.target.value })} />
      <label className="rc-label" htmlFor={`${type}-to`}>To date</label>
      <input id={`${type}-to`} type="date" className="form-control mb-3" value={range.to}
             onChange={(e) => setRange({ ...range, to: e.target.value })} />

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <button className="btn btn-rc mt-auto d-flex align-items-center justify-content-center gap-2"
              onClick={generate} disabled={busy}>
        <CloudDownload size={16} /> {busy ? 'Generating…' : 'Generate CSV & PDF'}
      </button>
    </div>
  )
}

export default function Reports() {
  return (
    <>
      <PageHeader title="Reports & Analytics" subtitle="Generate and export official barangay-level disaster response records" />
      <div className="row g-3 mb-3">
        {reports.map((r) => <div className="col-lg-4" key={r.type}><ReportCard {...r} /></div>)}
      </div>
      <div className="rc-compliance">
        <h3><ShieldCheck size={16} /> PH DSWD & LGU Reporting Standard Compliance</h3>
        <p className="small text-secondary mb-0">
          Reports contain personal information of registered households. Store and share exported files
          only with authorized personnel, in line with RA 10173 (Data Privacy Act of 2012).
        </p>
      </div>
    </>
  )
}
