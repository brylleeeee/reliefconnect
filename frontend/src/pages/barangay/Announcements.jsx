import { useEffect, useState } from 'react'
import { CheckCircle2, Megaphone, SquarePen, Trash2 } from 'lucide-react'
import api, { errorMessage } from '../../api/client'
import PageHeader from '../../components/PageHeader'
import AnnounceModal from '../../components/AnnounceModal'
import { fmtDateTime } from '../../components/format'
import useSummary from './useSummary'

export default function Announcements() {
  const [summary] = useSummary()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [composing, setComposing] = useState(null) // { initial, editingId?, note? }

  const load = () => api.get('/barangay/announcements')
    .then((r) => { setData(r.data); setError('') })
    .catch((err) => setError(errorMessage(err)))
  useEffect(() => { load() }, [])

  const relay = (a) => setComposing({
    initial: { title: a.title, description: a.description, source_announcement_id: a.id, distribution_event_id: a.distribution_event_id },
    note: 'Edit this into a message for your residents, for example with your purok details, before publishing.',
  })

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}"? Residents will no longer see it.`)) return
    try { await api.delete(`/barangay/announcements/${a.id}`); setNotice('Announcement deleted.'); load() }
    catch (err) { setError(errorMessage(err)) }
  }

  const pending = data?.from_lgu.filter((a) => !a.relayed).length ?? 0

  return (
    <>
      <PageHeader title="Announcements"
                  subtitle={`Read the LGU's announcements and inform the residents of Barangay ${summary?.barangay ?? ''}`} />

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {notice && <div className="alert alert-success py-2 small">{notice}</div>}

      <div className="row g-3">
        <div className="col-lg-6">
          <section className="rc-card h-100">
            <h2 className="rc-card-title mb-1">From the LGU</h2>
            <p className="small text-secondary">
              {pending > 0 ? `${pending} not yet announced to your residents.` : 'All announced to your residents.'}
            </p>
            {data?.from_lgu.length === 0 && <p className="small text-secondary mb-0">No announcements from the LGU yet.</p>}
            {data?.from_lgu.map((a) => (
              <div className="rc-advisory" key={a.id}>
                <div className="flex-grow-1">
                  <div>
                    <span className="rc-advisory-tag">{a.category}</span>
                    <span className="rc-advisory-time">{fmtDateTime(a.published_at)}</span>
                  </div>
                  <div className="rc-advisory-title">{a.title}</div>
                  <div className="rc-advisory-desc">{a.description}</div>
                </div>
                {a.relayed
                  ? <span className="rc-claim claimed text-nowrap"><CheckCircle2 size={13} /> Announced</span>
                  : <button className="btn btn-sm btn-rc text-nowrap" onClick={() => relay(a)}>Announce to residents</button>}
              </div>
            ))}
          </section>
        </div>

        <div className="col-lg-6">
          <section className="rc-card h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="rc-card-title mb-0">Your announcements to residents</h2>
              <button className="btn btn-sm btn-rc-outline text-nowrap"
                      onClick={() => setComposing({ initial: { title: '', description: '' } })}>
                <Megaphone size={13} className="me-1" />New
              </button>
            </div>
            {data?.mine.length === 0 && <p className="small text-secondary mb-0">You haven't announced anything to residents yet.</p>}
            {data?.mine.map((a) => (
              <div className="rc-advisory" key={a.id}>
                <div className="flex-grow-1">
                  <div>
                    <span className="rc-advisory-tag">{a.source_announcement_id ? 'Relayed from LGU' : a.category}</span>
                    <span className="rc-advisory-time">{fmtDateTime(a.published_at)}</span>
                  </div>
                  <div className="rc-advisory-title">{a.title}</div>
                  <div className="rc-advisory-desc">{a.description}</div>
                </div>
                <button className="btn-icon" aria-label={`Edit ${a.title}`}
                        onClick={() => setComposing({ initial: { title: a.title, description: a.description }, editingId: a.id })}>
                  <SquarePen size={14} />
                </button>
                <button className="btn-icon danger" aria-label={`Delete ${a.title}`} onClick={() => remove(a)}><Trash2 size={14} /></button>
              </div>
            ))}
          </section>
        </div>
      </div>

      {composing && (
        <AnnounceModal {...composing} onClose={() => setComposing(null)}
                       onSaved={() => { setComposing(null); setNotice('Published to your residents.'); load() }} />
      )}
    </>
  )
}
