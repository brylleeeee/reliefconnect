import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { PORTAL_ROLES, ROLE_HOME } from './roles'
import AdminLayout from './components/AdminLayout'
import Login from './pages/Login'
// LGU Admin
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Prioritization from './pages/Prioritization'
import Analytics from './pages/Analytics'
import Events from './pages/Events'
// Barangay Admin
import QrReview from './pages/barangay/QrReview'
import Households from './pages/barangay/Households'
import HouseholdEdit from './pages/barangay/HouseholdEdit'
import WalkIn from './pages/barangay/WalkIn'
import Distributions from './pages/barangay/Distributions'
import BarangayAnnouncements from './pages/barangay/Announcements'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-5 text-muted">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (!PORTAL_ROLES.includes(user.role)) return <Navigate to="/login?denied=1" replace />
  return children
}

/** Sends users to their own home page if they open a page for another role. */
function Only({ role, children }) {
  const { user } = useAuth()
  return user.role === role ? children : <Navigate to={ROLE_HOME[user.role]} replace />
}

const lgu = (el) => <Only role="municipal_admin">{el}</Only>
const brgy = (el) => <Only role="barangay_admin">{el}</Only>

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><AdminLayout /></RequireAuth>}>
        <Route path="/" element={lgu(<Dashboard />)} />
        <Route path="/inventory" element={lgu(<Inventory />)} />
        <Route path="/events" element={lgu(<Events />)} />
        <Route path="/prioritization" element={lgu(<Prioritization />)} />
        <Route path="/analytics" element={lgu(<Analytics />)} />

        <Route path="/qr-review" element={brgy(<QrReview />)} />
        <Route path="/households" element={brgy(<Households />)} />
        <Route path="/households/:id/edit" element={brgy(<HouseholdEdit />)} />
        <Route path="/walk-in" element={brgy(<WalkIn />)} />
        <Route path="/distributions" element={brgy(<Distributions />)} />
        <Route path="/announcements" element={brgy(<BarangayAnnouncements />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
