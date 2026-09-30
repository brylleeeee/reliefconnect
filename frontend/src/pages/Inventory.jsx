import { useEffect, useState } from 'react'
import { Package } from 'lucide-react'
import api, { errorMessage } from '../api/client'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'

const newIncoming = { relief_item_id: '', name: '', contents: '', unit: 'Packs', quantity: '', source: '' }

export default function Inventory() {
  const [data, setData] = useState(null)
  const [incoming, setIncoming] = useState(null)   // form state when modal open
  const [adjusting, setAdjusting] = useState(null) // { item, quantity, remarks }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = () => api.get('/admin/inventory').then((r) => setData(r.data))
  useEffect(() => { load() }, [])

  const close = () => { setIncoming(null); setAdjusting(null); setError('') }

  const run = async (fn) => {
    setBusy(true); setError('')
    try { await fn(); close(); load() }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  const submitIncoming = (e) => {
    e.preventDefault()
    const payload = incoming.relief_item_id
      ? { relief_item_id: incoming.relief_item_id, quantity: incoming.quantity, source: incoming.source }
      : incoming
    run(() => api.post('/admin/inventory/incoming', payload))
  }

  const submitAdjust = (e) => {
    e.preventDefault()
    run(() => api.post(`/admin/inventory/${adjusting.item.id}/adjust`, {
      quantity: Number(adjusting.quantity), remarks: adjusting.remarks,
    }))
  }

  const stats = data?.stats

  return (
    <>
      <PageHeader title="Relief Goods & Stock Management" subtitle="Municipal disaster response administration dashboard" />

      <div className="row g-3 mb-3">
        <div className="col-md-4"><div className="rc-stat">
          <div className="rc-stat-label">Total Packs Ready</div>
          <div className="rc-stat-value green">{stats ? `${stats.total_ready.toLocaleString()} units` : '—'}</div>
        </div></div>
        <div className="col-md-4"><div className="rc-stat">
          <div className="rc-stat-label">Distributed (Weekly)</div>
          <div className="rc-stat-value blue">{stats ? `${stats.distributed_this_week.toLocaleString()} units` : '—'}</div>
        </div></div>
        <div className="col-md-4"><div className="rc-stat">
          <div className="rc-stat-label">Critical Stock Alerts</div>
          <div className={`rc-stat-value ${stats?.critical_alerts ? 'danger' : ''}`}>
            {stats ? `${stats.critical_alerts} Items` : '—'}
          </div>
        </div></div>
      </div>

      <section className="rc-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="rc-card-title mb-0">LGU Relief Distribution Inventory Ledger</h2>
          <button className="btn btn-rc btn-sm" onClick={() => setIncoming(newIncoming)}>+ Log Incoming Stock</button>
        </div>

        <div className="table-responsive">
          <table className="rc-table">
            <thead>
              <tr>
                <th>Relief Item Description</th><th>In Stock</th><th>Distributed To Date</th>
                <th className="text-end">Operations</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <tr key={item.id}>
                  <td className="fw-semibold">
                    <Package size={14} className="me-2 text-success" />
                    {item.name}{item.contents && ` (${item.contents})`}
                  </td>
                  <td className="fw-bold text-nowrap">
                    {item.quantity_in_stock.toLocaleString()} {item.unit}
                    {item.is_low_stock && <span className="rc-low">LOW</span>}
                  </td>
                  <td className="muted">{item.distributed_to_date.toLocaleString()} {item.unit}</td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-rc-outline"
                            onClick={() => setAdjusting({ item, quantity: '', remarks: '' })}>Adjust Stock</button>
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr><td colSpan={4} className="text-center muted py-4">No relief items yet. Log incoming stock to start the ledger.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {incoming && (
        <Modal title="Log Incoming Stock" onClose={close}>
          <form onSubmit={submitIncoming}>
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            <label className="rc-label">Relief item</label>
            <select className="form-select mb-3" value={incoming.relief_item_id}
                    onChange={(e) => setIncoming({ ...incoming, relief_item_id: e.target.value })}>
              <option value="">New item…</option>
              {data.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>

            {!incoming.relief_item_id && (
              <>
                <label className="rc-label">Item name</label>
                <input className="form-control mb-3" required value={incoming.name}
                       onChange={(e) => setIncoming({ ...incoming, name: e.target.value })} />
                <div className="row g-2 mb-3">
                  <div className="col-8">
                    <label className="rc-label">Contents</label>
                    <input className="form-control" placeholder="e.g. Rice, Canned Goods" value={incoming.contents}
                           onChange={(e) => setIncoming({ ...incoming, contents: e.target.value })} />
                  </div>
                  <div className="col-4">
                    <label className="rc-label">Unit</label>
                    <input className="form-control" required value={incoming.unit}
                           onChange={(e) => setIncoming({ ...incoming, unit: e.target.value })} />
                  </div>
                </div>
              </>
            )}

            <div className="row g-2 mb-4">
              <div className="col-4">
                <label className="rc-label">Quantity</label>
                <input type="number" min="1" className="form-control" required value={incoming.quantity}
                       onChange={(e) => setIncoming({ ...incoming, quantity: e.target.value })} />
              </div>
              <div className="col-8">
                <label className="rc-label">Source / donor</label>
                <input className="form-control" placeholder="e.g. DSWD Field Office I" value={incoming.source}
                       onChange={(e) => setIncoming({ ...incoming, source: e.target.value })} />
              </div>
            </div>
            <button className="btn btn-rc w-100" disabled={busy}>{busy ? 'Saving…' : 'Log Stock'}</button>
          </form>
        </Modal>
      )}

      {adjusting && (
        <Modal title={`Adjust Stock: ${adjusting.item.name}`} onClose={close}>
          <form onSubmit={submitAdjust}>
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            <p className="small text-secondary">
              Currently {adjusting.item.quantity_in_stock} {adjusting.item.unit} in stock.
              Use a negative number to deduct (e.g. −10 for damaged goods).
            </p>
            <label className="rc-label">Change in quantity</label>
            <input type="number" className="form-control mb-3" required value={adjusting.quantity}
                   onChange={(e) => setAdjusting({ ...adjusting, quantity: e.target.value })} />
            <label className="rc-label">Reason</label>
            <input className="form-control mb-4" required placeholder="e.g. Water damage during storage"
                   value={adjusting.remarks} onChange={(e) => setAdjusting({ ...adjusting, remarks: e.target.value })} />
            <button className="btn btn-rc w-100" disabled={busy}>{busy ? 'Saving…' : 'Save Adjustment'}</button>
          </form>
        </Modal>
      )}
    </>
  )
}
