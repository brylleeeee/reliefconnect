import { NavLink } from 'react-router-dom'
import {
  LayoutGrid, QrCode, Archive, BarChart3, Users, UserPlus, MapPin, ShieldPlus, LogOut, Scale,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const LINKS = {
  municipal_admin: [
    { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
    { to: '/inventory', label: 'Inventory', icon: Archive },
    { to: '/prioritization', label: 'Aid Prioritization', icon: Scale },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  ],
  barangay_admin: [
    { to: '/qr-review', label: 'QR Issuance Review', icon: QrCode },
    { to: '/households', label: 'Household Records', icon: Users },
    { to: '/walk-in', label: 'Walk-in Registration', icon: UserPlus },
  ],
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const initials = user?.name?.split(' ').map((w) => w[0]).slice(-2).join('') ?? '?'
  const isBarangay = user?.role === 'barangay_admin'

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
        {(LINKS[user?.role] ?? []).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="rc-nav-link">
            <Icon size={16} /> {label}
          </NavLink>
        ))}
      </nav>

      <div className="rc-user">
        <span className="rc-avatar">{initials}</span>
        <div className="flex-grow-1 min-w-0">
          <div className="rc-user-name text-truncate">{user?.name}</div>
          <div className="rc-user-role text-truncate">{user?.position}</div>
        </div>
        <button className="btn btn-link p-1 text-secondary" onClick={logout} title="Log out" aria-label="Log out">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}
