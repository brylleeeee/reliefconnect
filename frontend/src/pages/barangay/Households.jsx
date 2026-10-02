import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import HouseholdDetail from '../../components/HouseholdDetail'
import { PriorityBadge, StatusBadge } from '../../components/Badges'
import useSummary from './useSummary'

export default function Households() {
  const navigate = useNavigate()
  const [summary] = useSummary()
  const [filters, setFilters] = useState({ search: '', status: 'approved', purok: '', priority: '' })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState(null)
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    const params = Object.fromEntries(Object.entries({ ...filters, page }).filter(([, v]) => v))
    api.get('/barangay/households', { params }).then((r) => setList(r.data))
  }, [filters, page])

  // Wait for the user to stop typing before searching
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setFilters((f) => ({ ...f, search })) }, 350)
    return () => clearTimeout(t)
  }, [search])

  const setFilter = (k, v) => { setPage(1); setFilters((f) => ({ ...f, [k]: v })) }
  const open = async (id) => setViewing((await api.get(`/barangay/households/${id}`)).data)

  return (
    <>
      <PageHeader title="Household Records" subtitle={`Masterlist of Barangay ${summary?.barangay ?? ''}`} />

      <section className="rc-card">
        <div className="row g-2 mb-3">
          <div className="col-md-5">
            <div className="rc-search">
              <Search size={15} />
              <input className="form-control" placeholder="Search by name, member, or reference no."
                     aria-label="Search households" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="col-md-2">
            <select className="form-select" aria-label="Status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
              <option value="">All statuses</option><option value="approved">Approved</option>
              <option value="pending">Pending</option><option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="col-md-2">
            <select className="form-select" aria-label="Purok" value={filters.purok} onChange={(e) => setFilter('purok', e.target.value)}>
              <option value="">All puroks</option>
              {summary?.puroks.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <select className="form-select" aria-label="Priority" value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}>
              <option value="">All priority levels</option><option value="high">High</option>
              <option value="medium">Medium</option><option value="low">Low</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="rc-table">
            <thead>
              <tr><th>Reference no.</th><th>Household head</th><th>Purok</th><th>Members</th><th>Priority</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {list?.data.map((h) => (
                <tr key={h.id}>
                  <td className="text-nowrap">{h.reference_number ?? <span className="muted">—</span>}</td>
                  <td className="fw-semibold">{h.household_head}</td>
                  <td>{h.purok}</td>
                  <td>{h.members_count}</td>
                  <td><PriorityBadge level={h.priority_level} score={h.priority_score} /></td>
                  <td><StatusBadge status={h.status} /></td>
                  <td className="text-end text-nowrap">
                    <button className="btn btn-sm btn-rc-outline me-1" onClick={() => open(h.id)}>View</button>
                    <button className="btn btn-sm btn-rc-outline" onClick={() => navigate(`/households/${h.id}/edit`)}>Edit</button>
                  </td>
                </tr>
              ))}
              {list?.data.length === 0 && (
                <tr><td colSpan={7} className="text-center muted py-4">No households match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination meta={list} onPage={setPage} />
      </section>

      {viewing && (
        <Modal title={viewing.household_head} size="lg" onClose={() => setViewing(null)}>
          <HouseholdDetail h={viewing} />
          <div className="d-flex justify-content-end mt-3">
            <button className="btn btn-rc" onClick={() => navigate(`/households/${viewing.id}/edit`)}>Edit Household</button>
          </div>
        </Modal>
      )}
    </>
  )
}
