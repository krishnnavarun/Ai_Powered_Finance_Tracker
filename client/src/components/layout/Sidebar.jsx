import { NavLink, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { logout } from '../../redux/slices/authSlice'

function Sidebar() {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const navItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Transactions', path: '/transactions' },
    { label: 'Budget', path: '/budget' },
    { label: 'Insights', path: '/insights' },
    { label: 'Reports', path: '/reports' },
    { label: 'Profile', path: '/profile' }
  ]

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  return (
    <aside className="flex w-full flex-col border-b border-slate-800/80 bg-slate-950 text-white shadow-2xl lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div className="border-b border-white/10 px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">AI Finance Tracker</p>
        <h2 className="mt-2 text-2xl font-semibold">FinTrack</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">A disciplined view of cash flow, budgets, and monthly momentum.</p>
      </div>

      <nav className="grid flex-1 gap-2 px-4 py-4 sm:grid-cols-2 lg:grid-cols-1 lg:px-4 lg:py-5">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                isActive
                  ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/30'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-[11px] font-semibold">
              {item.label.slice(0, 2).toUpperCase()}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Logout
        </button>
      </div>
    </aside>
  )
}

export default Sidebar