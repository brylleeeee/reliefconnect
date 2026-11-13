import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, ShieldCheck, ShieldPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../api/client'
import { PORTAL_ROLES, ROLE_HOME } from '../roles'
import '../styles/login.css'

// Put the official municipal seal at frontend/public/urbiztondo-seal.png. Until then, the app mark is shown.
const SEAL_SRC = '/urbiztondo-seal.png'

/** Rice terraces seen from above: Urbiztondo's farmland, in layered greens, with planted rows. */
const TERRACES = [
  'M0 118 C130 88 270 150 410 116 S690 78 800 108',
  'M0 178 C150 146 300 208 460 174 S705 142 800 170',
  'M0 238 C140 212 320 266 485 232 S722 206 800 230',
  'M0 298 C170 272 335 324 525 292 S735 268 800 292',
  'M0 356 C160 334 362 376 545 350 S742 332 800 352',
]

function Paddies() {
  return (
    <svg className="rc-auth-paddies" viewBox="0 0 800 420" preserveAspectRatio="none" aria-hidden="true">
      {TERRACES.map((d, i) => (
        <g key={d} className={`terrace t${i + 1}`}>
          <path className="band" d={`${d} L800 420 L0 420 Z`} />
          {/* planted rows inside the terrace, then its edge */}
          <path className="row" d={d} transform="translate(0 16)" />
          <path className="row" d={d} transform="translate(0 32)" />
          <path className="edge" d={d} />
        </g>
      ))}
    </svg>
  )
}

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
        <p className="rc-auth-republic">Republic of the Philippines</p>

        <div className="rc-auth-identity">
          <div className="rc-auth-lgu">
            <div className="rc-auth-seal">
              {sealOk
                ? <img src={SEAL_SRC} alt="Seal of the Municipality of Urbiztondo" onError={() => setSealOk(false)} />
                : <ShieldPlus size={34} aria-hidden="true" />}
            </div>
            <div>
              <p className="rc-auth-province">Province of Pangasinan</p>
              <p className="rc-auth-municipality">Municipality of Urbiztondo</p>
            </div>
          </div>

          <h1 className="rc-auth-app">ReliefConnect</h1>
          <p className="rc-auth-tagline">Getting relief to every household in Urbiztondo, fairly and on record.</p>
        </div>

        <Paddies />
      </aside>

      {/* Right: sign in */}
      <main className="rc-auth-panel">
        <form className="rc-auth-form" onSubmit={submit}>
          <h2 className="rc-auth-title">Sign in to the admin portal</h2>
          <p className="rc-auth-sub">For LGU and barangay administrators.</p>

          {error && <div className="rc-auth-error" role="alert">{error}</div>}

          <label className="rc-auth-label" htmlFor="email">Email</label>
          <div className="rc-auth-field">
            <Mail size={17} className="rc-auth-icon" aria-hidden="true" />
            <input id="email" type="email" className="form-control" required autoFocus autoComplete="username"
                   placeholder="name@urbiztondo.gov.ph"
                   value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          <label className="rc-auth-label" htmlFor="password">Password</label>
          <div className="rc-auth-field">
            <Lock size={17} className="rc-auth-icon" aria-hidden="true" />
            <input id="password" type={showPassword ? 'text' : 'password'} className="form-control has-toggle" required
                   autoComplete="current-password" placeholder="Enter your password"
                   value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button type="button" className="rc-auth-toggle" onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          <button className="rc-auth-submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="rc-auth-help">Forgot your password? Ask your LGU system administrator to reset it.</p>
        </form>

        <p className="rc-auth-secure">
          <ShieldCheck size={15} aria-hidden="true" />
          Access is limited to authorized LGU and barangay personnel.
        </p>
      </main>
    </div>
  )
}