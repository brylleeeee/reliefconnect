import { useEffect, useState } from 'react'
import { KeyRound, UserPlus, UserX, UserCheck, RefreshCw } from 'lucide-react'
import api, { errorMessage } from '../../api/client'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import useConfirm from '../../components/useConfirm'
import { fmtDateTime } from '../../components/format'
import useSummary from './useSummary'

/** Easy-to-type temporary password, e.g. "Relief-4827" (staff change it in the app afterwards). */
const tempPassword = () => `Relief-${Math.floor(1000 + Math.random() * 9000)}`

const EMPTY = { name: '', username: '', phone: '', password: '' }

export default function StaffAccounts() {
  const [summary] = useSummary()
  const [staff, setStaff] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [adding, setAdding] = useState(false)
  const [resetting, setResetting] = useState(null) // the staff whose password is being reset
  const [loginInfo, setLoginInfo] = useState(null) // { name, username, password } to hand to the staff
  const [confirm, confirmDialog] = useConfirm()

  const load = () => api.get('/barangay/staff')
    .then((r) => { setStaff(r.data); setError('') })
    .catch((err) => setError(errorMessage(err)))
  useEffect(() => { load() }, [])

  const toggle = async (s) => {
    if (s.is_active) {
      if (!(await confirm({
        title: `Deactivate ${s.name}?`, confirmLabel: 'Deactivate', danger: true,
        message: 'They are logged out of their phone and can no longer log in. Their past releases stay in the records. You can reactivate them anytime.',
      }))) return
    }
    try {
      const r = await api.post(`/barangay/staff/${s.id}/${s.is_active ? 'deactivate' : 'activate'}`)
      setNotice(r.data.message)
      load()
    } catch (err) { setError(errorMessage(err)) }
  }

  return (
    <>
      <PageHeader title="Staff Accounts"
                  subtitle={`Distribution staff who scan QR codes and release aid in Barangay ${summary?.barangay ?? ''}`}
                  actions={(
                    <button className="btn btn-rc" onClick={() => setAdding(true)}>
                      <UserPlus size={15} className="me-1" />Add staff
                    </button>
                  )} />

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {notice && <div className="alert alert-success py-2 small">{notice}</div>}

      <section className="rc-card">
        <p className="small text-secondary">
          Staff log in to the <b>ReliefConnect mobile app</b> (Barangay Staff Portal) with their username and the
          temporary password you set. They only see your barangay's distributions, and can change their password
          in the app (tap their name, then Change Password).
        </p>

        {staff === null && !error && <p className="small text-secondary mb-0">Loading…</p>}
        {staff?.length === 0 && <p className="small text-secondary mb-0">No staff accounts yet. Add your first one.</p>}

        {staff?.length > 0 && (
          <div className="table-responsive">
            <table className="rc-table">
              <thead>
                <tr><th>Name</th><th>Username</th><th>Mobile</th><th>Status</th><th>Last active</th><th /></tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className={s.is_active ? '' : 'text-secondary'}>
                    <td className="fw-semibold">{s.name}</td>
                    <td><code>{s.username}</code></td>
                    <td>{s.phone ?? '—'}</td>
                    <td>
                      {s.is_active
                        ? <span className="badge text-bg-success">Active</span>
                        : <span className="badge text-bg-secondary">Deactivated</span>}
                    </td>
                    <td className="small">{s.last_active_at ? fmtDateTime(s.last_active_at) : 'Never logged in'}</td>
                    <td className="text-nowrap text-end">
                      {s.is_active && (
                        <button className="btn btn-sm btn-rc-outline me-2" onClick={() => setResetting(s)}>
                          <KeyRound size={13} className="me-1" />Reset password
                        </button>
                      )}
                      <button className={`btn btn-sm ${s.is_active ? 'btn-outline-danger' : 'btn-rc-outline'}`} onClick={() => toggle(s)}>
                        {s.is_active
                          ? <><UserX size={13} className="me-1" />Deactivate</>
                          : <><UserCheck size={13} className="me-1" />Reactivate</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirmDialog}

      {adding && (
        <AddStaffModal
          onClose={() => setAdding(false)}
          onSaved={(info) => { setAdding(false); setLoginInfo(info); setNotice(`${info.name} can now log in.`); load() }} />
      )}

      {resetting && (
        <ResetPasswordModal
          staff={resetting}
          onClose={() => setResetting(null)}
          onSaved={(info) => { setResetting(null); setLoginInfo(info); setNotice(`Password reset for ${info.name}.`); load() }} />
      )}

      {loginInfo && <LoginInfoModal info={loginInfo} onClose={() => setLoginInfo(null)} />}
    </>
  )
}

function Field({ label, error, hint, children }) {
  return (
    <div className="mb-3">
      <label className="form-label small fw-semibold">{label}</label>
      {children}
      {hint && !error && <div className="form-text">{hint}</div>}
      {error && <div className="small text-danger mt-1">{error}</div>}
    </div>
  )
}

const firstErrors = (err) => Object.fromEntries(
  Object.entries(err.response?.data?.errors ?? {}).map(([k, v]) => [k, v[0]]))

function AddStaffModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY, password: tempPassword() })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await api.post('/barangay/staff', { ...form, phone: form.phone || null })
      onSaved({ name: r.data.name, username: r.data.username, password: form.password })
    } catch (err) {
      setErrors(firstErrors(err))
      if (!err.response?.data?.errors) setErrors({ name: errorMessage(err) })
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Add staff account" onClose={onClose}>
      <form onSubmit={save}>
        <Field label="Full name" error={errors.name}>
          <input className="form-control" value={form.name} onChange={set('name')} required autoFocus />
        </Field>
        <Field label="Username" error={errors.username} hint='What they type to log in, e.g. "btc.juan". No spaces.'>
          <input className="form-control" value={form.username} onChange={set('username')} required autoCapitalize="none" />
        </Field>
        <Field label="Mobile number (optional)" error={errors.phone}>
          <input className="form-control" value={form.phone} onChange={set('phone')} placeholder="09XXXXXXXXX" inputMode="numeric" />
        </Field>
        <Field label="Temporary password" error={errors.password} hint="At least 8 characters. They can change it in the app.">
          <div className="input-group">
            <input className="form-control" value={form.password} onChange={set('password')} required />
            <button type="button" className="btn btn-outline-secondary" title="Generate another"
                    onClick={() => setForm({ ...form, password: tempPassword() })}>
              <RefreshCw size={14} />
            </button>
          </div>
        </Field>
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
          <button className="btn btn-rc" disabled={saving}>{saving ? 'Creating…' : 'Create account'}</button>
        </div>
      </form>
    </Modal>
  )
}

function ResetPasswordModal({ staff, onClose, onSaved }) {
  const [password, setPassword] = useState(tempPassword())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/barangay/staff/${staff.id}/reset-password`, { password })
      onSaved({ name: staff.name, username: staff.username, password })
    } catch (err) {
      setError(firstErrors(err).password ?? errorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Reset password: ${staff.name}`} onClose={onClose}>
      <form onSubmit={save}>
        <p className="small text-secondary">They will be logged out of their phone and must log in with the new temporary password.</p>
        <Field label="New temporary password" error={error}>
          <div className="input-group">
            <input className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="btn btn-outline-secondary" title="Generate another" onClick={() => setPassword(tempPassword())}>
              <RefreshCw size={14} />
            </button>
          </div>
        </Field>
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
          <button className="btn btn-rc" disabled={saving}>{saving ? 'Saving…' : 'Reset password'}</button>
        </div>
      </form>
    </Modal>
  )
}

/** Shown once after creating or resetting, so the admin can give the details to the staff. */
function LoginInfoModal({ info, onClose }) {
  return (
    <Modal title="Give these login details to the staff" onClose={onClose}>
      <div className="rc-card mb-3" style={{ background: 'var(--rc-bg, #f6f8f9)' }}>
        <div className="small text-secondary">Name</div>
        <div className="fw-semibold mb-2">{info.name}</div>
        <div className="small text-secondary">Username</div>
        <div className="fw-semibold mb-2"><code>{info.username}</code></div>
        <div className="small text-secondary">Temporary password</div>
        <div className="fw-semibold"><code>{info.password}</code></div>
      </div>
      <p className="small text-secondary">
        This password is not shown again. In the mobile app they choose <b>Barangay Staff Portal</b>, log in,
        then change it: tap their name, then <b>Change Password</b>.
      </p>
      <div className="d-flex justify-content-end">
        <button className="btn btn-rc" onClick={onClose}>Done</button>
      </div>
    </Modal>
  )
}
