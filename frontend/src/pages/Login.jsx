import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../api/client'
import { PORTAL_ROLES, ROLE_HOME } from '../roles'

export default function Login() {
  const { user, login, logout } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(params.get('denied') ? 'This portal is for LGU and barangay administrators only.' : '')
  const [busy, setBusy] = useState(false)

  if (PORTAL_ROLES.includes(user?.role)) return <Navigate to={ROLE_HOME[user.role]} replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const u = await login(form.email, form.password)
      if (!PORTAL_ROLES.includes(u.role)) {
        await logout()
        setError('This portal is for LGU and barangay administrators only.')
      } else {
        navigate(ROLE_HOME[u.role])
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rc-login">
      <form className="rc-card" onSubmit={submit}>
        <div className="rc-brand mb-1">
          <span className="rc-brand-mark"><ShieldPlus size={18} /></span>
          ReliefConnect
        </div>
        <p className="text-secondary small mb-4">LGU Urbiztondo admin portal for municipal and barangay administrators</p>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <label className="rc-label" htmlFor="email">Email</label>
        <input id="email" type="email" className="form-control mb-3" required autoFocus
               value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

        <label className="rc-label" htmlFor="password">Password</label>
        <input id="password" type="password" className="form-control mb-4" required
               value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />

        <button className="btn btn-rc w-100" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </div>
  )
}
