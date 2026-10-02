import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AdminLayout() {
  return (
    <div className="rc-shell">
      <Sidebar />
      <main className="rc-main">
        <Outlet />
      </main>
    </div>
  )
}
