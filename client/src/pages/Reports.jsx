import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { downloadMonthlyReport, getMonthlyReport } from '../services/reportService'
import { formatCurrency, formatDate } from '../utils/format'
import SummaryCard from '../components/dashboard/SummaryCard'

function Reports() {
  const now = new Date()
  const [period, setPeriod] = useState({ month: String(now.getMonth() + 1).padStart(2, '0'), year: now.getFullYear() })
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const params = useMemo(() => period, [period])

  useEffect(() => {
    let mounted = true

    const loadReport = async () => {
      try {
        setLoading(true)
        const response = await getMonthlyReport(params)
        if (mounted) {
          setReport(response.data.data)
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError.response?.data?.message || requestError.message || 'Unable to load report')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadReport()

    return () => {
      mounted = false
    }
  }, [params])

  const exportPdf = async () => {
    const response = await downloadMonthlyReport(params)
    const blob = new Blob([response.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `finance-report-${report?.period || `${params.year}-${params.month}`}.pdf`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const chartData = report?.categoryBreakdown || []

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Reports</h2>
          <p className="mt-1 text-sm text-slate-500">Monthly summaries, exportable as PDF directly from the backend.</p>
        </div>
        <button onClick={exportPdf} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:bg-slate-800">
          Export PDF
        </button>
      </div>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <select value={period.month} onChange={(event) => setPeriod((current) => ({ ...current, month: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100">
            {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((month) => (
              <option key={month} value={month}>
                {new Date(2000, Number(month) - 1, 1).toLocaleDateString('en-IN', { month: 'long' })}
              </option>
            ))}
          </select>
          <input type="number" value={period.year} onChange={(event) => setPeriod((current) => ({ ...current, year: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Selected period: {period.year}-{period.month}
          </div>
        </div>
      </section>

      {loading && <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Loading report...</div>}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {report && !loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Income" value={formatCurrency(report.totalIncome)} tone="green" />
            <SummaryCard label="Expense" value={formatCurrency(report.totalExpense)} tone="red" />
            <SummaryCard label="Savings" value={formatCurrency(report.savings)} tone="blue" />
            <SummaryCard label="Remaining" value={formatCurrency(report.budgetRemaining)} tone="slate" />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm xl:col-span-2">
              <h3 className="text-lg font-semibold text-slate-900">Category Analytics</h3>
              <p className="text-sm text-slate-500">The category split for the selected month.</p>
              <div className="mt-4 h-72">
                {chartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="category" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip />
                      <Bar dataKey="amount" fill="#0f172a" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid h-full place-items-center rounded-3xl border border-dashed border-slate-200 text-sm text-slate-500">
                    No category analytics for this period.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Transactions</h3>
              <p className="text-sm text-slate-500">All transactions included in the generated report.</p>
              <div className="mt-4 max-h-72 space-y-3 overflow-auto">
                {report.transactions.length ? (
                  report.transactions.map((item) => (
                    <div key={item._id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{item.title}</p>
                          <p className="text-sm text-slate-500">
                            {item.category} · {formatDate(item.transactionDate)}
                          </p>
                        </div>
                        <p className={`font-semibold ${item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">No transactions for this period.</div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}

export default Reports