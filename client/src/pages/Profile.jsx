import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { updateProfileThunk } from '../redux/slices/authSlice'
import { changePassword, getAccountStats } from '../services/authService'
import { formatCurrency } from '../utils/format'

function Profile() {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const [profile, setProfile] = useState({ name: '', email: '' })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' })
  const [stats, setStats] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setProfile({ name: user.name || '', email: user.email || '' })
    }

    const loadStats = async () => {
      try {
        const response = await getAccountStats()
        setStats(response.data.data)
      } catch (requestError) {
        setError(requestError.response?.data?.message || requestError.message || 'Unable to load account statistics')
      }
    }

    loadStats()
  }, [user])

  const saveProfile = async (event) => {
    event.preventDefault()
    setMessage('')
    setError('')

    try {
      await dispatch(updateProfileThunk(profile)).unwrap()
      setMessage('Profile updated successfully.')
    } catch (profileError) {
      setError(profileError)
    }
  }

  const savePassword = async (event) => {
    event.preventDefault()
    setMessage('')
    setError('')

    try {
      await changePassword(passwords)
      setPasswords({ currentPassword: '', newPassword: '' })
      setMessage('Password changed successfully.')
    } catch (passwordError) {
      setError(passwordError.response?.data?.message || passwordError.message || 'Unable to change password')
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Profile</h2>
        <p className="mt-1 text-sm text-slate-500">Manage your account details and password tied to the authentication backend.</p>
      </div>

      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm xl:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900">User Details</h3>
          <form onSubmit={saveProfile} className="mt-4 grid gap-4 md:grid-cols-2">
            <input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} placeholder="Full Name" className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            <input value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} type="email" placeholder="Email Address" className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:bg-slate-800">
                Save Profile
              </button>
            </div>
          </form>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <h3 className="text-lg font-semibold text-slate-900">Change Password</h3>
            <form onSubmit={savePassword} className="mt-4 grid gap-4 md:grid-cols-2">
              <input value={passwords.currentPassword} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} type="password" placeholder="Current Password" className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
              <input value={passwords.newPassword} onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))} type="password" minLength="6" placeholder="New Password" className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  Change Password
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Account Statistics</h3>
          <div className="mt-4 space-y-4">
            <div className="rounded-3xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Transactions</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{stats?.transactionCount || 0}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Income</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-600">{formatCurrency(stats?.totalIncome)}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Expenses</p>
              <p className="mt-1 text-2xl font-semibold text-rose-600">{formatCurrency(stats?.totalExpense)}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Savings</p>
              <p className="mt-1 text-2xl font-semibold text-sky-600">{formatCurrency(stats?.savings)}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Profile