import { useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'

function Navbar() {
  const { user } = useSelector((state) => state.auth)
  const location = useLocation()

  const pageLabels = {
    '/dashboard': 'Dashboard',
    '/transactions': 'Transactions',
    '/budget': 'Budget Planner',
    '/insights': 'Insights',
    '/reports': 'Reports',
    '/profile': 'Profile'
  }

  const pageTitle = pageLabels[location.pathname] || 'Finance Dashboard'
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  })

  return (
    <nav className="border-b border-white/60 bg-white/80 backdrop-blur-xl">
      <div className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6 xl:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">FinTrack</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900 md:text-2xl">{pageTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">{today}</p>
        </div>

        <div className="flex items-center gap-3 self-start rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm md:self-auto">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'FT'}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{user?.name || 'Guest user'}</p>
            <p className="text-xs text-slate-500">{user?.email || 'Manage your finances with confidence'}</p>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar