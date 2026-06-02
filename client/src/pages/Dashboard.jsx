import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import SummaryCard from '../components/dashboard/SummaryCard'
import { getDashboardSummary } from '../services/dashboardService'
import { formatCurrency, formatDate } from '../utils/format'

const COLORS = ['#2563eb', '#059669', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2']

const formatMonth = (value) => {
  if (!value) {
    return '-'
  }

  const date = new Date(`${value}-01T00:00:00`)
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const loadSummary = async () => {
      try {
        setLoading(true)
        const response = await getDashboardSummary()

        if (mounted) {
          setSummary(response.data.data)
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError.response?.data?.message || requestError.message || 'Unable to load dashboard')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadSummary()

    return () => {
      mounted = false
    }
  }, [])

  const trend = summary?.monthlyTrend || []
  const categories = summary?.categoryBreakdown || []
  const incomeExpense = useMemo(
    () =>
      trend.map((item) => ({
        month: formatMonth(item.month),
        Income: item.income || 0,
        Expense: item.expense || 0
      })),
    [trend]
  )

  const cards = [
    { label: 'Total Income', value: formatCurrency(summary?.totalIncome), tone: 'green' },
    { label: 'Total Expense', value: formatCurrency(summary?.totalExpense), tone: 'red' },
    { label: 'Savings', value: formatCurrency(summary?.savings), tone: 'blue' },
    { label: 'Budget Remaining', value: formatCurrency(summary?.budgetRemaining), tone: 'slate' }
  ]

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 text-white shadow-2xl">
        <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.3fr_0.7fr] lg:px-8 lg:py-10">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Live finance overview
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Track every rupee with a clear, executive-level dashboard.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Connects directly to your backend to pull transactions, budget status, category spend, and savings momentum in one polished view.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Connected</p>
                <p className="mt-2 text-lg font-semibold">Backend APIs</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Focus</p>
                <p className="mt-2 text-lg font-semibold">Budget discipline</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Mode</p>
                <p className="mt-2 text-lg font-semibold">AI-assisted</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-sm text-slate-300">This month</p>
              <p className="mt-2 text-3xl font-semibold">{formatCurrency(summary?.totalExpense)}</p>
              <p className="mt-2 text-sm text-slate-400">Expense volume currently flowing through your tracked accounts.</p>
            </div>
            <div className="rounded-[1.75rem] border border-emerald-400/20 bg-emerald-400/10 p-5">
              <p className="text-sm text-emerald-100">Savings buffer</p>
              <p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(summary?.savings)}</p>
              <p className="mt-2 text-sm text-emerald-100/80">Positive cash flow indicates headroom for goals or debt paydown.</p>
            </div>
          </div>
        </div>
      </section>

      {loading && <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">Loading dashboard...</div>}

      {error && <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((item) => (
          <SummaryCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Monthly Spending Trend</h3>
              <p className="text-sm text-slate-500">Income versus expense across the months already stored in your database.</p>
            </div>
          </div>
          <div className="mt-5 h-80">
            {incomeExpense.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={incomeExpense}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Line type="monotone" dataKey="Income" stroke="#059669" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="Expense" stroke="#dc2626" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-3xl border border-dashed border-slate-200 text-sm text-slate-500">
                Add transactions to see your monthly trend.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Category Distribution</h3>
            <p className="text-sm text-slate-500">A quick scan of where the money is going.</p>
          </div>
          <div className="mt-5 h-80">
            {categories.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categories} dataKey="amount" nameKey="category" outerRadius={110} innerRadius={70} paddingAngle={3}>
                    {categories.map((entry, index) => (
                      <Cell key={`cell-${entry.category}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-3xl border border-dashed border-slate-200 text-sm text-slate-500">
                Expense categories will appear here.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm xl:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900">Income vs Expense</h3>
          <p className="text-sm text-slate-500">Compare inflows and outflows per month.</p>
          <div className="mt-5 h-80">
            {incomeExpense.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeExpense}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="Income" fill="#059669" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="Expense" fill="#dc2626" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-3xl border border-dashed border-slate-200 text-sm text-slate-500">
                No comparison data available yet.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Recent Transactions</h3>
          <p className="text-sm text-slate-500">Most recent items from the ledger.</p>
          <div className="mt-5 space-y-3">
            {summary?.recentTransactions?.length ? (
              summary.recentTransactions.map((item) => (
                <article key={item._id} className="rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-500">
                        {item.category} · {formatDate(item.transactionDate)}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold ${item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                No transactions yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Dashboard