import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, ShieldPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../api/client'
import { PORTAL_ROLES, ROLE_HOME } from '../roles'
import '../styles/login.css'

// Put the official municipal seal at frontend/public/urbiztondo-seal.png. Until then, the app mark is shown.
const SEAL_SRC = '/urbiztondo-seal.png'

export default function Login() {
  const { user, login, logout } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [sealOk, setSealOk] = useState(true)
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
    <div className="rc-auth">
      {/* Left: the municipality */}
      <aside className="rc-auth-hero">
        <div className="rc-auth-republic">
          <span className="rc-auth-flag" aria-hidden="true"><i /><i /><i /></span>
          Republic of the Philippines
        </div>

        <div className="rc-auth-identity">
          <div className="rc-auth-seal">
            {sealOk
              ? <img src={SEAL_SRC} alt="Seal of the Municipality of Urbiztondo" onError={() => setSealOk(false)} />
              : <ShieldPlus size={44} aria-hidden="true" />}
          </div>
          <p className="rc-auth-province">Province of Pangasinan</p>
          <p className="rc-auth-municipality">Municipality of Urbiztondo</p>
          <span className="rc-auth-rule" aria-hidden="true" />
          <h1 className="rc-auth-app">ReliefConnect</h1>
          <p className="rc-auth-tagline">Aid distribution and beneficiary tracking</p>
        </div>

        <p className="rc-auth-foot">For authorized LGU and barangay personnel only.</p>
      </aside>

      {/* Right: sign in */}
      <main className="rc-auth-panel">
        <form className="rc-auth-form" onSubmit={submit} noValidate={false}>
          <p className="rc-auth-eyebrow">Admin portal</p>
          <h2 className="rc-auth-title">Sign in</h2>
          <p className="rc-auth-sub">Use your LGU or barangay administrator account.</p>

          {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}

          <label className="rc-label" htmlFor="email">Email</label>
          <div className="rc-auth-field">
            <Mail size={16} className="rc-auth-icon" aria-hidden="true" />
            <input id="email" type="email" className="form-control" required autoFocus autoComplete="username"
                   placeholder="name@urbiztondo.gov.ph"
                   value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          <label className="rc-label" htmlFor="password">Password</label>
          <div className="rc-auth-field">
            <Lock size={16} className="rc-auth-icon" aria-hidden="true" />
            <input id="password" type={showPassword ? 'text' : 'password'} className="form-control has-toggle" required
                   autoComplete="current-password" placeholder="Enter your password"
                   value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button type="button" className="rc-auth-toggle" onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button className="btn btn-rc rc-auth-submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="rc-auth-help">Forgot your password? Contact your LGU system administrator.</p>
        </form>
      </main>
    </div>
  )
}
