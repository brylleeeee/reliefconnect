import { useState } from 'react'
import { CheckCircle2, Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/PageHeader'
import HouseholdForm from '../../components/HouseholdForm'
import { PriorityBadge } from '../../components/Badges'
import useSummary from './useSummary'

/** Easy to read aloud and type: no 0/O or 1/l/I. */
const newPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  const pick = () => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length]
  return Array.from({ length: 8 }, pick).join('')
}

export default function WalkIn() {
  const [summary, reloadSummary] = useSummary()
  const [done, setDone] = useState(null)
  const [formKey, setFormKey] = useState(0)
  const [password, setPassword] = useState(newPassword)
  const [showPassword, setShowPassword] = useState(true)

  const register = async (payload) => {
    const r = await api.post('/barangay/households', payload)
    setDone({ ...r.data, password })
    reloadSummary()
  }

  const next = () => { setDone(null); setPassword(newPassword()); setFormKey((k) => k + 1) }

  // Resident login: the account is created together with the household
  const loginSection = (
    <section className="rc-card mb-3">
      <h2 className="rc-card-title d-flex align-items-center gap-2"><KeyRound size={16} /> Resident app login</h2>
      <p className="small text-secondary">
        A ReliefConnect account is created with this household. The resident logs in with their mobile number
        above, or with their reference number if they have no mobile, and this password.
      </p>
      <label className="rc-label" htmlFor="walkin-password">Password</label>
      <div className="d-flex gap-2" style={{ maxWidth: 460 }}>
        <input id="walkin-password" className="form-control" type={showPassword ? 'text' : 'password'} required minLength={8} maxLength={100}
               autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="button" className="btn btn-light" onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}>
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button type="button" className="btn btn-rc-outline d-flex align-items-center gap-1 text-nowrap" onClick={() => setPassword(newPassword())}>
          <RefreshCw size={14} /> Generate
        </button>
      </div>
      <div className="small text-secondary mt-1">At least 8 characters. Write it on the slip for the resident.</div>
    </section>
  )

  return (
    <>
      <PageHeader title="Walk-in Registration"
                  subtitle="For residents who register at the barangay. Check their documents in person; the household is approved and a resident login is created on save." />

      {done ? (
        <section className="rc-card text-center py-5">
          <CheckCircle2 size={40} className="text-success mb-2" />
          <h2 className="h5 fw-bold mb-1">{done.household_head}'s household is registered</h2>
          <p className="text-secondary mb-3">Give the resident this reference number to claim relief.</p>
          <div className="rc-ref-number mb-3">{done.reference_number}</div>
          <p className="small text-secondary">
            {done.members_count} member{done.members_count === 1 ? "" : "s"} · Priority <PriorityBadge level={done.priority_level} score={done.priority_score} />
            {done.contact_number && <> · Reference number will be sent by SMS to {done.contact_number}</>}
          </p>
          <div className="rc-login-slip mx-auto mb-3">
            <div className="rc-label mb-1">ReliefConnect app login</div>
            <div className="small">Log in with: <b>{done.account?.login_ids?.join(' or ')}</b></div>
            <div className="small">Password: <b className="font-monospace">{done.password}</b></div>
          </div>
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
          <HouseholdForm key={formKey} puroks={summary?.puroks} submitLabel="Register & Create Account"
                         onSubmit={register} extra={loginSection} extraValues={{ password }} />
        </>
      )}
    </>
  )
}
