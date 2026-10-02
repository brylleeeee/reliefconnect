import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/PageHeader'
import HouseholdForm from '../../components/HouseholdForm'
import { PriorityBadge } from '../../components/Badges'
import useSummary from './useSummary'

export default function WalkIn() {
  const [summary, reloadSummary] = useSummary()
  const [done, setDone] = useState(null)
  const [formKey, setFormKey] = useState(0)

  const register = async (payload) => {
    const r = await api.post('/barangay/households', payload)
    setDone(r.data)
    reloadSummary()
  }

  const next = () => { setDone(null); setFormKey((k) => k + 1) }

  return (
    <>
      <PageHeader title="Walk-in Registration"
                  subtitle="For residents without a phone or internet. Check their documents in person; the household is approved on save." />

      {done ? (
        <section className="rc-card text-center py-5">
          <CheckCircle2 size={40} className="text-success mb-2" />
          <h2 className="h5 fw-bold mb-1">{done.household_head}'s household is registered</h2>
          <p className="text-secondary mb-3">Give the resident this reference number to claim relief.</p>
          <div className="rc-ref-number mb-3">{done.reference_number}</div>
          <p className="small text-secondary">
            {done.members_count} members · Priority <PriorityBadge level={done.priority_level} score={done.priority_score} />
            {done.contact_number && <> · Reference number will be sent by SMS to {done.contact_number}</>}
          </p>
          <div className="d-flex justify-content-center gap-2">
            <button className="btn btn-rc-outline" onClick={() => window.print()}>Print Slip</button>
            <button className="btn btn-rc" onClick={next}>Register Another Household</button>
          </div>
        </section>
      ) : (
        <>
          <p className="small text-secondary">
            Walk-ins registered this month: <b>{summary?.walk_ins_this_month ?? '—'}</b>. If a member is already
            registered anywhere in Urbiztondo, the system will stop the duplicate and show where they are listed.
          </p>
          <HouseholdForm key={formKey} puroks={summary?.puroks} submitLabel="Register & Issue Reference No."
                         onSubmit={register} />
        </>
      )}
    </>
  )
}
