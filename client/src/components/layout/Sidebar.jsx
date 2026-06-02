import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { logout } from '../../redux/slices/authSlice'

// props: none
function Sidebar() {
  // location → useLocation()
  // dispatch → useDispatch()
  // navigate → useNavigate()

  // navItems → array of { label, path } for: Dashboard, Transactions, Budget, Insights, Reports, Profile

  // isActive(path) → returns true if location.pathname matches path

  // handleLogout() → dispatches logout(), navigates to '/login'

  return (
    <aside className="w-64 bg-primary text-white h-screen flex flex-col">
      <div className="p-6 border-b border-gray-700">
        {/* App title */}
        {/* App subtitle */}
      </div>

      <nav className="flex-1 p-4">
        {/* Map over navItems → each renders a <Link> with active style if isActive */}
      </nav>

      <div className="p-4 border-t border-gray-700">
        {/* Logout button → calls handleLogout on click */}
      </div>
    </aside>
  )
}

export default Sidebar