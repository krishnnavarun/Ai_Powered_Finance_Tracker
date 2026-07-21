import { useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'

function Navbar({ onToggleSidebar }) {
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
      <div className="flex items-center justify-between gap-4 px-4 py-3 md:py-4 md:px-6 xl:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition hover:bg-slate-50 lg:hidden"
            aria-label="Open sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">FinTrack</p>
            <h1 className="mt-0.5 text-lg font-semibold text-slate-900 md:text-2xl">{pageTitle}</h1>
            <p className="mt-0.5 text-xs text-slate-500 hidden sm:block">{today}</p>
          </div>
        </div>

        {/* Desktop Profile Card */}
        <div className="hidden md:flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'FT'}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{user?.name || 'Guest user'}</p>
            <p className="text-xs text-slate-500">{user?.email || 'Manage your finances'}</p>
          </div>
        </div>

        {/* Mobile Profile Avatar */}
        <div className="md:hidden flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white shadow-sm">
          {user?.name ? user.name.slice(0, 2).toUpperCase() : 'FT'}
        </div>
      </div>
    </nav>
  )
}

export default Navbar