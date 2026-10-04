import { useEffect, useState } from 'react'
import { Package, Wallet, HandHeart, Plus } from 'lucide-react'
import api, { errorMessage } from '../api/client'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import SourceSelect from '../components/SourceSelect'
import { fmtDate, fmtDateTime, peso, qtyUnit } from '../components/format'

const TABS = [
  { key: 'goods', label: 'Relief goods', icon: Package },
  { key: 'cash', label: 'Cash aid', icon: Wallet },
  { key: 'sources', label: 'Sources', icon: HandHeart },
]
const newGoods = { relief_item_id: '', name: '', contents: '', unit: '', quantity: '', source_id: '', remarks: '' }
const newCash = { relief_item_id: '', type: 'cash', name: '', quantity: '', source_id: '', remarks: '' }
const MOVE_LABEL = { incoming: 'Received', adjustment: 'Adjusted', distribution: 'Released' }

export default function Inventory() {
  const [tab, setTab] = useState('goods')
  const [data, setData] = useState(null)
  const [sources, setSources] = useState({ types: [], sources: [] })
  const [incoming, setIncoming] = useState(null)   // form state when the receive modal is open
  const [adjusting, setAdjusting] = useState(null) // { item, quantity, remarks }
  const [history, setHistory] = useState(null)     // item whose history is open
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const isCash = tab === 'cash'
  const load = () => {
    if (tab !== 'sources') api.get('/admin/inventory', { params: { type: tab } }).then((r) => setData(r.data))
    api.get('/admin/sources').then((r) => setSources(r.data))
  }
  useEffect(() => { setData(null); load() }, [tab])

  const close = () => { setIncoming(null); setAdjusting(null); setError('') }
  const run = async (fn, message) => {
    setBusy(true); setError('')
    try { await fn(); close(); setNotice(message); load() }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  const submitIncoming = (e) => {
    e.preventDefault()
    const payload = incoming.relief_item_id
      ? { relief_item_id: incoming.relief_item_id, quantity: incoming.quantity, source_id: incoming.source_id || null, remarks: incoming.remarks || null }
      : { ...incoming, source_id: incoming.source_id || null }
    run(() => api.post('/admin/inventory/incoming', payload), isCash ? 'Funds recorded.' : 'Stock logged.')
  }

  const submitAdjust = (e) => {
    e.preventDefault()
    run(() => api.post(`/admin/inventory/${adjusting.item.id}/adjust`, {
      quantity: Number(adjusting.quantity), remarks: adjusting.remarks,
    }), 'Adjustment saved.')
  }

  const amount = (n, unit) => (isCash ? peso(n) : `${Number(n).toLocaleString()} ${unit}`)
  const s = data?.stats

  return (
    <>
      <PageHeader title="Inventory" subtitle="Relief goods and cash aid, kept separate, with where each came from"
        actions={tab !== 'sources' && (
          <button className="btn btn-rc d-flex align-items-center gap-2"
                  onClick={() => { setNotice(''); setIncoming(isCash ? newCash : newGoods) }}>
            <Plus size={15} /> {isCash ? 'Record Funds Received' : 'Log Incoming Stock'}
          </button>
        )} />

      <div className="rc-tabs mb-3" role="tablist">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''}
                  onClick={() => { setNotice(''); setTab(key) }}>
            <Icon size={14} className="me-1" />{label}
          </button>
        ))}
      </div>

      {notice && <div className="alert alert-success py-2 small">{notice}</div>}

      {tab === 'goods' && (
        <div className="row g-3 mb-3">
          <div className="col-md-4"><div className="rc-stat">
            <div className="rc-stat-label">Relief item types</div>
            <div className="rc-stat-value green">{s ? s.item_types : '—'}</div>
          </div></div>
          <div className="col-md-4"><div className="rc-stat">
            <div className="rc-stat-label">Released this week</div>
            <div className="rc-stat-value blue">{s ? `${s.released_this_week.toLocaleString()} units` : '—'}</div>
          </div></div>
          <div className="col-md-4"><div className="rc-stat">
            <div className="rc-stat-label">Low stock items</div>
            <div className={`rc-stat-value ${s?.critical_alerts ? 'danger' : ''}`}>{s ? s.critical_alerts : '—'}</div>
          </div></div>
        </div>
      )}

      {tab === 'cash' && (
        <div className="row g-3 mb-3">
          <div className="col-6 col-md-3"><div className="rc-stat green">
            <div className="rc-stat-label">Fund balance</div>
            <div className="rc-stat-value green">{s ? peso(s.balance) : '—'}</div>
          </div></div>
          <div className="col-6 col-md-3"><div className="rc-stat blue">
            <div className="rc-stat-label">Reserved for events</div>
            <div className="rc-stat-value blue">{s ? peso(s.reserved) : '—'}</div>
            <div className="small text-secondary">promised, not yet released</div>
          </div></div>
          <div className="col-6 col-md-3"><div className="rc-stat">
            <div className="rc-stat-label">Available</div>
            <div className="rc-stat-value">{s ? peso(s.available) : '—'}</div>
          </div></div>
          <div className="col-6 col-md-3"><div className="rc-stat">
            <div className="rc-stat-label">Released to households</div>
            <div className="rc-stat-value">{s ? peso(s.released_to_date) : '—'}</div>
            <div className="small text-secondary">{s ? `${peso(s.released_this_week)} this week` : ''}</div>
          </div></div>
        </div>
      )}

      {tab !== 'sources' && (
        <section className="rc-card">
          <h2 className="rc-card-title">{isCash ? 'Cash funds' : 'Relief goods ledger'}</h2>
          <p className="small text-secondary">
            Click {isCash ? 'a fund' : 'an item'} to see its history: what was received and from which source, adjustments, and releases.
            <b> Available</b> is what's left after the amounts promised to open distribution events.
          </p>
          <div className="table-responsive">
            <table className="rc-table">
              <thead>
                <tr>
                  <th>{isCash ? 'Fund' : 'Relief item'}</th><th>{isCash ? 'Balance' : 'In stock'}</th>
                  <th>Reserved</th><th>Available</th><th>{isCash ? 'Released to date' : 'Distributed to date'}</th><th />
                </tr>
              </thead>
              <tbody>
                {data?.items.map((item) => (
                  <tr key={item.id} className="rc-row-click" tabIndex={0} onClick={() => setHistory(item)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setHistory(item) }}>
                    <td className="fw-semibold">
                      {isCash ? <Wallet size={14} className="me-2 text-success" /> : <Package size={14} className="me-2 text-success" />}
                      {item.name}{item.contents && <span className="text-secondary fw-normal"> ({item.contents})</span>}
                    </td>
                    <td className="fw-bold text-nowrap">
                      {amount(item.quantity_in_stock, item.unit)}
                      {item.is_low_stock && <span className="rc-low">LOW</span>}
                    </td>
                    <td className="text-nowrap">{item.reserved ? amount(item.reserved, item.unit) : '—'}</td>
                    <td className="text-nowrap">{amount(item.available, item.unit)}</td>
                    <td className="muted text-nowrap">{amount(item.distributed_to_date, item.unit)}</td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-rc-outline"
                              onClick={(e) => { e.stopPropagation(); setNotice(''); setAdjusting({ item, quantity: '', remarks: '' }) }}>
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr><td colSpan={6} className="text-center muted py-4">
                    {isCash ? 'No cash funds yet. Record funds received to start.' : 'No relief items yet. Log incoming stock to start the ledger.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'sources' && <SourcesTab data={sources} onChanged={(msg) => { setNotice(msg); load() }} />}

      {incoming && (
        <Modal title={isCash ? 'Record Funds Received' : 'Log Incoming Stock'} onClose={close}>
          <form onSubmit={submitIncoming}>
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            <label className="rc-label" htmlFor="inc-item">{isCash ? 'Cash fund' : 'Relief item'}</label>
            <select id="inc-item" className="form-select mb-3" value={incoming.relief_item_id}
                    onChange={(e) => setIncoming({ ...incoming, relief_item_id: e.target.value })}>
              <option value="">{isCash ? 'New fund…' : 'New item…'}</option>
              {data.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>

            {!incoming.relief_item_id && (
              <>
                <label className="rc-label" htmlFor="inc-name">{isCash ? 'Fund name' : 'Item name'}</label>
                <input id="inc-name" className="form-control mb-3" required value={incoming.name} maxLength={150}
                       placeholder={isCash ? 'e.g. Emergency Cash Assistance Fund' : 'e.g. NFA Rice'}
                       onChange={(e) => setIncoming({ ...incoming, name: e.target.value })} />
                {!isCash && (
                  <div className="row g-2 mb-3">
                    <div className="col-7">
                      <label className="rc-label" htmlFor="inc-contents">Contents (optional)</label>
                      <input id="inc-contents" className="form-control" placeholder="e.g. Rice, Canned Goods" value={incoming.contents}
                             onChange={(e) => setIncoming({ ...incoming, contents: e.target.value })} />
                    </div>
                    <div className="col-5">
                      <label className="rc-label" htmlFor="inc-unit">Unit</label>
                      <select id="inc-unit" className="form-select" required value={incoming.unit}
                              onChange={(e) => setIncoming({ ...incoming, unit: e.target.value })}>
                        <option value="" disabled>Choose…</option>
                        {data.units.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}

            <label className="rc-label" htmlFor="inc-qty">{isCash ? 'Amount (₱)' : 'Quantity'}</label>
            <input id="inc-qty" type="number" min="1" className="form-control mb-3" required value={incoming.quantity}
                   onChange={(e) => setIncoming({ ...incoming, quantity: e.target.value })} />

            <label className="rc-label" htmlFor="inc-source">Source</label>
            <div className="mb-3">
              <SourceSelect id="inc-source" sources={sources.sources} types={sources.types} value={incoming.source_id}
                            onChange={(v) => setIncoming((f) => ({ ...f, source_id: v }))}
                            onSourceAdded={(src) => setSources((d) => ({ ...d, sources: [...d.sources, src].sort((a, b) => a.name.localeCompare(b.name)) }))} />
            </div>
            <label className="rc-label" htmlFor="inc-remarks">Remarks (optional)</label>
            <input id="inc-remarks" className="form-control mb-4" maxLength={255}
                   placeholder={isCash ? 'e.g. Check no. 004512' : 'e.g. Delivered to Municipal Gym'}
                   value={incoming.remarks} onChange={(e) => setIncoming({ ...incoming, remarks: e.target.value })} />
            <button className="btn btn-rc w-100" disabled={busy}>{busy ? 'Saving…' : isCash ? 'Record Funds' : 'Log Stock'}</button>
          </form>
        </Modal>
      )}

      {adjusting && (
        <Modal title={`Adjust: ${adjusting.item.name}`} onClose={close}>
          <form onSubmit={submitAdjust}>
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            <p className="small text-secondary">
              Currently {amount(adjusting.item.quantity_in_stock, adjusting.item.unit)}.
              Use a negative number to deduct (e.g. −10 for damaged goods).
            </p>
            <label className="rc-label" htmlFor="adj-qty">Change in {isCash ? 'amount (₱)' : 'quantity'}</label>
            <input id="adj-qty" type="number" className="form-control mb-3" required value={adjusting.quantity}
                   onChange={(e) => setAdjusting({ ...adjusting, quantity: e.target.value })} />
            <label className="rc-label" htmlFor="adj-reason">Reason</label>
            <input id="adj-reason" className="form-control mb-4" required maxLength={255}
                   placeholder={isCash ? 'e.g. Returned to treasury' : 'e.g. Water damage during storage'}
                   value={adjusting.remarks} onChange={(e) => setAdjusting({ ...adjusting, remarks: e.target.value })} />
            <button className="btn btn-rc w-100" disabled={busy}>{busy ? 'Saving…' : 'Save Adjustment'}</button>
          </form>
        </Modal>
      )}

      {history && <HistoryModal item={history} onClose={() => setHistory(null)} />}
    </>
  )
}

function HistoryModal({ item, onClose }) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  useEffect(() => { api.get(`/admin/inventory/${item.id}/movements`, { params: { page } }).then((r) => setData(r.data)) }, [item.id, page])
  const fmt = (n) => qtyUnit(Math.abs(n), item.unit) // "1 Pack", "50 Packs", "₱1,000"

  return (
    <Modal title={`History: ${item.name}`} size="lg" onClose={onClose}>
      <p className="small text-secondary">
        Now: <b>{item.unit === 'PHP' ? peso(item.quantity_in_stock) : qtyUnit(item.quantity_in_stock, item.unit)}</b>
        {item.reserved > 0 && <> · {item.unit === 'PHP' ? peso(item.reserved) : qtyUnit(item.reserved, item.unit)} reserved for open events</>}
      </p>
      <div className="table-responsive">
        <table className="rc-table">
          <thead><tr><th>Date</th><th>Type</th><th className="text-end">Change</th><th>Source / reason</th><th>By</th></tr></thead>
          <tbody>
            {data?.data.map((m) => (
              <tr key={m.id}>
                <td className="text-nowrap">{fmtDateTime(m.created_at)}</td>
                <td><span className={`rc-move ${m.type}`}>{MOVE_LABEL[m.type] ?? m.type}</span></td>
                <td className={`text-end text-nowrap fw-semibold ${m.quantity < 0 ? 'text-danger' : 'text-success'}`}>
                  {m.quantity < 0 ? '−' : '+'}{fmt(m.quantity)}
                </td>
                <td className="small">
                  {m.source ? <>{m.source.name} <span className="text-secondary">({m.source.type_label})</span></> : (m.remarks ?? '—')}
                  {m.source && m.remarks && <span className="text-secondary"> · {m.remarks}</span>}
                </td>
                <td className="small text-secondary">{m.user?.name}</td>
              </tr>
            ))}
            {data?.data.length === 0 && <tr><td colSpan={5} className="text-center muted py-3">No history yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination meta={data} onPage={setPage} />
    </Modal>
  )
}

const TYPE_TONE = { donation: 'incoming', lgu_fund: 'adjustment', government_allocation: 'distribution' }

function SourcesTab({ data, onChanged }) {
  const [form, setForm] = useState({ type: 'donation', name: '' })
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { types, sources } = data

  const add = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try { const r = await api.post('/admin/sources', form); setForm({ ...form, name: '' }); onChanged(`Added ${r.data.name}.`) }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  const saveEdit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try { await api.put(`/admin/sources/${editing.id}`, { name: editing.name, type: editing.type }); setEditing(null); onChanged('Source updated.') }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  return (
    <>
      <div className="row g-3 mb-3">
        {types.map((t) => {
          const list = sources.filter((s) => s.type === t.key)
          const cash = list.reduce((n, s) => n + s.cash_total, 0)
          return (
            <div className="col-md-4" key={t.key}>
              <div className="rc-stat h-100">
                <div className="rc-stat-label">{t.label}</div>
                <div className="rc-stat-value">{list.length}</div>
                <div className="small text-secondary">source{list.length === 1 ? '' : 's'}{cash ? ` · ${peso(cash)} cash` : ''}</div>
              </div>
            </div>
          )
        })}
      </div>

      <section className="rc-card">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
          <div>
            <h2 className="rc-card-title mb-1">Sources</h2>
            <p className="small text-secondary mb-0">Where relief goods and cash came from. The full list with dates is in Reports → Sources of Relief.</p>
          </div>
          <form className="d-flex gap-2" onSubmit={add}>
            <select className="form-select form-select-sm" aria-label="Source type" value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <input className="form-control form-control-sm" placeholder="New source name" aria-label="New source name"
                   value={form.name} maxLength={150} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <button className="btn btn-sm btn-rc text-nowrap" disabled={busy || !form.name.trim()}>+ Add new source</button>
          </form>
        </div>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <div className="table-responsive">
          <table className="rc-table">
            <thead><tr><th>Source</th><th>Type</th><th>Times received</th><th>Relief goods given</th><th>Cash given</th><th>Last received</th><th /></tr></thead>
            <tbody>
              {types.map((t) => sources.filter((s) => s.type === t.key).map((src) => (
                <tr key={src.id}>
                  <td className="fw-semibold">{src.name}</td>
                  <td><span className={`rc-move ${TYPE_TONE[src.type]}`}>{src.type_label}</span></td>
                  <td>{src.times_received}</td>
                  <td className="small">{src.goods.length ? src.goods.map((g) => `${qtyUnit(g.total, g.unit)} of ${g.item}`).join(', ') : '—'}</td>
                  <td className="text-nowrap">{src.cash_total ? peso(src.cash_total) : '—'}</td>
                  <td className="text-secondary text-nowrap">{src.last_received ? fmtDate(src.last_received.slice(0, 10)) : '—'}</td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-rc-outline" onClick={() => setEditing({ id: src.id, name: src.name, type: src.type })}>Edit</button>
                  </td>
                </tr>
              )))}
              {sources.length === 0 && <tr><td colSpan={7} className="text-center muted py-4">No sources yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <Modal title="Edit source" onClose={() => { setEditing(null); setError('') }}>
          <form onSubmit={saveEdit}>
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            <label className="rc-label" htmlFor="src-type">Type</label>
            <select id="src-type" className="form-select mb-3" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
              {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <label className="rc-label" htmlFor="src-name">Name</label>
            <input id="src-name" className="form-control mb-4" required maxLength={150} value={editing.name}
                   onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <button className="btn btn-rc w-100" disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button>
          </form>
        </Modal>
      )}
    </>
  )
}
