import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutGrid, QrCode, Archive, FileText, Users, UserPlus, MapPin, ShieldPlus, Scale,
  CalendarCheck, ClipboardCheck, MapPinned, Megaphone, History as HistoryIcon, TriangleAlert, UserCog, FilePen,
} from 'lucide-react'
import api from '../api/client'
import useLiveTick from './useLiveTick'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'

const LINKS = {
  municipal_admin: [
    { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
    { to: '/sos', label: 'SOS Prioritization', icon: TriangleAlert },
    { to: '/inventory', label: 'Inventory', icon: Archive },
    { to: '/events', label: 'Distribution Events', icon: CalendarCheck },
    { to: '/barangays', label: 'Barangay Summary', icon: MapPinned }, // also opened from the Dashboard's Needs attention cards
    { to: '/prioritization', label: 'Aid Prioritization', icon: Scale },
    { to: '/reports', label: 'Reports', icon: FileText },
  ],
  barangay_admin: [
    { to: '/distributions', label: 'Distributions', icon: ClipboardCheck },
    { to: '/qr-review', label: 'QR Issuance Review', icon: QrCode },
    { to: '/households', label: 'Household Records', icon: Users },
    { to: '/update-requests', label: 'Update Requests', icon: FilePen, badge: 'update_requests_pending' },
    { to: '/walk-in', label: 'Walk-in Registration', icon: UserPlus },
    { to: '/history', label: 'Distribution History', icon: HistoryIcon },
    { to: '/announcements', label: 'Announcements', icon: Megaphone, badge: 'announcements_unread' },
    { to: '/staff', label: 'Staff Accounts', icon: UserCog },
  ],
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const initials = user?.name?.split(' ').map((w) => w[0]).slice(-2).join('') ?? '?'
  const isBarangay = user?.role === 'barangay_admin'

  // Barangay: counts next to the menu items (waiting update requests, new LGU announcements), refreshed live.
  // While the Announcements page is open the announcements count is cleared on the server.
  const [counts, setCounts] = useState({})
  const tick = useLiveTick()
  const { pathname } = useLocation()
  const onAnnouncements = pathname.startsWith('/announcements')

  useEffect(() => {
    if (!isBarangay) return
    const merge = (extra) => setCounts((c) => ({ ...c, ...extra }))

    api.get('/barangay/summary').then((r) => merge(r.data)).catch(() => {})

    if (onAnnouncements) {
      api.post('/barangay/announcements/seen').then(() => merge({ announcements_unread: 0 })).catch(() => {})
    } else {
      api.get('/barangay/announcements/unread-count')
        .then((r) => merge({ announcements_unread: r.data.unread }))
        .catch(() => {})
    }
  }, [isBarangay, tick, onAnnouncements])

  return (
    <aside className="rc-sidebar">
      <div className="rc-brand">
        <span className="rc-brand-mark"><ShieldPlus size={18} /></span>
        ReliefConnect
      </div>

      <div className="rc-location">
        <MapPin size={16} />
        <div>
          <div className="rc-location-name">
            {isBarangay ? `Barangay ${user.barangay?.name}` : 'Municipality of Urbiztondo'}
          </div>
          <div className="rc-location-sub">{isBarangay ? 'Barangay Portal' : 'PH LGU Portal'}</div>
        </div>
      </div>

      <nav className="rc-nav">
        {(LINKS[user?.role] ?? []).map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end} className="rc-nav-link">
            <Icon size={16} /> {label}
            {badge && counts[badge] > 0 && (
              <span
                className="rc-nav-badge"
                aria-label={`${counts[badge]} ${badge === 'announcements_unread' ? 'new' : 'waiting'}`}
              >
                {counts[badge]}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* The whole profile card is the log out button, with a confirmation */}
      <button type="button" className="rc-user" onClick={() => setConfirming(true)} title="Log out">
        <span className="rc-avatar">{initials}</span>
        <span className="flex-grow-1 min-w-0 text-start">
          <span className="rc-user-name text-truncate d-block">{user?.name}</span>
          <span className="rc-user-role text-truncate d-block">{user?.position}</span>
        </span>
      </button>

      {confirming && (
        <Modal title="Log out?" onClose={() => setConfirming(false)}>
          <p className="small text-secondary">
            You are signed in as <b>{user?.name}</b>. You will need your email and password to sign in again.
          </p>
          <div className="d-flex justify-content-end gap-2">
            <button className="btn btn-light" onClick={() => setConfirming(false)} autoFocus>Cancel</button>
            <button className="btn btn-rc" onClick={logout}>Log out</button>
          </div>
        </Modal>
      )}
    </aside>
  )
}
