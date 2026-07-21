import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { loginUser } from '../redux/slices/authSlice'

const CoinIcon = () => (
  <svg className="w-10 h-10 drop-shadow-[0_8px_16px_rgba(245,158,11,0.22)] opacity-85 hover:opacity-100 transition-opacity duration-300" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" stroke="url(#goldGradient)" strokeWidth="2.2" fill="rgba(251, 191, 36, 0.12)" />
    <circle cx="20" cy="20" r="13" stroke="url(#goldGradient)" strokeWidth="1.2" strokeDasharray="3 3" />
    <path d="M20 11V29M16 16H22C24 16 25 17 25 18.5C25 20 24 21 22 21H16V21.5M19 21H25C27 21 28 22 28 23.5C28 25 27 26 25 26H16" stroke="url(#goldGradient)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <defs>
      <linearGradient id="goldGradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fbbf24" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>
    </defs>
  </svg>
)

const BillIcon = () => (
  <svg className="w-16 h-10 drop-shadow-[0_8px_16px_rgba(16,185,129,0.22)] opacity-85 hover:opacity-100 transition-opacity duration-300" viewBox="0 0 60 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="58" height="34" rx="4" stroke="url(#cashGradient)" strokeWidth="2.2" fill="rgba(52, 211, 153, 0.12)" />
    <circle cx="30" cy="18" r="8" stroke="url(#cashGradient)" strokeWidth="1.8" />
    <path d="M8 8V12M8 8H12M52 8V12M52 8H48M8 28V24M8 28H12M52 28V24M52 28H48" stroke="url(#cashGradient)" strokeWidth="1.5" strokeLinecap="round" />
    <defs>
      <linearGradient id="cashGradient" x1="0" y1="0" x2="60" y2="36" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
    </defs>
  </svg>
)

const floatingElements = [
  { type: 'coin', left: '8%', delay: '0s', duration: '7s' },
  { type: 'bill', left: '24%', delay: '1.5s', duration: '9s' },
  { type: 'coin', left: '44%', delay: '0.5s', duration: '8s' },
  { type: 'bill', left: '62%', delay: '3s', duration: '10s' },
  { type: 'coin', left: '78%', delay: '1s', duration: '7.5s' },
  { type: 'bill', left: '90%', delay: '4s', duration: '8.5s' },
]

function Login() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { loading } = useSelector((state) => state.auth)
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [error, setError] = useState('')

  const handleChange = (event) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    try {
      await dispatch(loginUser(formData)).unwrap()
      navigate('/dashboard')
    } catch (requestError) {
      setError(requestError)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
      <section className="hidden lg:flex items-center bg-slate-950 px-6 py-12 text-white sm:px-10 lg:px-16">
        <div className="max-w-xl space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">FinTrack Pro</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">A cleaner way to monitor cash flow, budgets, and growth.</h1>
          <p className="max-w-lg text-sm leading-7 text-slate-300 sm:text-base">
            Sign in to the dashboard connected to your backend services and review transactions, reports, budgets, and AI guidance in one place.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Live data</p>
              <p className="mt-2 font-semibold">API-backed</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Reports</p>
              <p className="mt-2 font-semibold">Exportable</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Insights</p>
              <p className="mt-2 font-semibold">AI assisted</p>
            </div>
          </div>
          <div className="lg:hidden pt-2">
            <button
              type="button"
              onClick={() => document.getElementById('auth-form')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-400/20 transition hover:bg-cyan-300 active:scale-95"
            >
              Scroll to Login Form
              <svg className="h-4 w-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      <section id="auth-form" className="relative flex items-center justify-center bg-[#fbfbfd] bg-[linear-gradient(to_right,rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] [background-size:32px_32px] px-6 py-12 sm:px-10 overflow-hidden min-h-screen">
        {/* Soft Radial Ambient Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12),transparent_65%)] pointer-events-none" />

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes float-up-sway {
            0% {
              transform: translateY(15vh) translateX(0px) rotate(0deg);
              opacity: 0;
            }
            10% {
              opacity: 0.95;
            }
            90% {
              opacity: 0.95;
            }
            100% {
              transform: translateY(-115vh) translateX(35px) rotate(15deg);
              opacity: 0;
            }
          }
        `}} />

        {/* Floating Money SVGs */}
        {floatingElements.map((item, index) => (
          <div
            key={index}
            className="absolute bottom-0 select-none pointer-events-none"
            style={{
              left: item.left,
              animationName: 'float-up-sway',
              animationDuration: item.duration,
              animationDelay: item.delay,
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
              animationFillMode: 'both',
            }}
          >
            {item.type === 'coin' ? <CoinIcon /> : <BillIcon />}
          </div>
        ))}

        <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-slate-200/60 bg-white/70 p-6 sm:p-8 shadow-[0_24px_64px_rgba(15,23,42,0.06)] backdrop-blur-2xl text-slate-900">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Welcome back</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Login</h2>
            <p className="mt-2 text-sm text-slate-500">Access your financial dashboard.</p>
          </div>

          {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
              <input name="email" type="email" value={formData.email} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
              <input name="password" type="password" value={formData.password} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            </div>

            <button type="submit" className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:bg-slate-800 active:scale-95">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-semibold text-slate-900 underline decoration-sky-400 underline-offset-4 hover:text-slate-700">
              Create one
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}

export default Login