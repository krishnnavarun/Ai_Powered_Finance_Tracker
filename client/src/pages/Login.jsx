import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { loginUser } from '../redux/slices/authSlice'

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
      <section className="flex items-center bg-slate-950 px-6 py-12 text-white sm:px-10 lg:px-16">
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
        </div>
      </section>

      <section className="flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-6 py-12 sm:px-10">
        <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-2xl">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Welcome back</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Login</h2>
            <p className="mt-2 text-sm text-slate-500">Access your financial dashboard.</p>
          </div>

          {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
              <input name="email" type="email" value={formData.email} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
              <input name="password" type="password" value={formData.password} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            </div>

            <button type="submit" className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:bg-slate-800">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-semibold text-slate-900 underline decoration-sky-400 underline-offset-4">
              Create one
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}

export default Login