import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchBudget, saveBudget } from '../redux/slices/budgetSlice'
import { getDashboardSummary } from '../services/dashboardService'
import { categories, formatCurrency } from '../utils/format'

function Budget() {
  const dispatch = useDispatch()
  const budget = useSelector((state) => state.budget)
  const [monthlyBudget, setMonthlyBudget] = useState(0)
  const [categoryBudgets, setCategoryBudgets] = useState([{ category: categories[0], limit: 0 }])
  const [summary, setSummary] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    dispatch(fetchBudget())

    const loadSummary = async () => {
      const response = await getDashboardSummary()
      setSummary(response.data.data)
    }

    loadSummary()
  }, [dispatch])

  useEffect(() => {
    setMonthlyBudget(budget.monthlyBudget || 0)
    setCategoryBudgets(budget.categories?.length ? budget.categories : [{ category: categories[0], limit: 0 }])
  }, [budget.monthlyBudget, budget.categories])

  const spentByCategory = useMemo(
    () =>
      (summary?.categoryBreakdown || []).reduce((accumulator, item) => {
        accumulator[item.category] = item.amount
        return accumulator
      }, {}),
    [summary]
  )

  const totalExpense = summary?.totalExpense || 0
  const remaining = monthlyBudget - totalExpense
  const usedPercent = monthlyBudget ? Math.min((totalExpense / monthlyBudget) * 100, 100) : 0

  const addCategory = () => {
    setCategoryBudgets((current) => [...current, { category: categories[0], limit: 0 }])
  }

  const updateCategory = (index, field, value) => {
    setCategoryBudgets((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)))
  }

  const removeCategory = (index) => {
    setCategoryBudgets((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const save = async (event) => {
    event.preventDefault()
    setMessage('')

    try {
      await dispatch(saveBudget({ monthlyBudget: Number(monthlyBudget), categoryBudgets })).unwrap()
      const response = await getDashboardSummary()
      setSummary(response.data.data)
      setMessage('Budget saved successfully.')
    } catch (error) {
      setMessage(error)
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Budget Planner</h2>
        <p className="mt-1 text-sm text-slate-500">Define your monthly spending ceiling and set category guardrails.</p>
      </div>

      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {budget.error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{budget.error}</div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm xl:col-span-2">
          <form onSubmit={save} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700">Monthly Budget</label>
              <input
                type="number"
                min="0"
                value={monthlyBudget}
                onChange={(event) => setMonthlyBudget(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Category Budgets</h3>
                <p className="text-sm text-slate-500">Set soft limits for the categories that matter most.</p>
              </div>
              <button type="button" onClick={addCategory} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                Add Category
              </button>
            </div>

            <div className="space-y-3">
              {categoryBudgets.map((item, index) => {
                const spent = spentByCategory[item.category] || 0
                const percent = item.limit ? Math.min((spent / item.limit) * 100, 100) : 0

                return (
                  <div key={`${item.category}-${index}`} className="rounded-3xl border border-slate-200 p-4">
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-[1.4fr_0.8fr_auto]">
                      <div className="grid gap-2 grid-cols-2 sm:contents">
                        <select value={item.category} onChange={(event) => updateCategory(index, 'category', event.target.value)} className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100">
                          {categories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                        <input type="number" min="0" value={item.limit} onChange={(event) => updateCategory(index, 'limit', event.target.value)} placeholder="Limit" className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
                      </div>
                      <button type="button" onClick={() => removeCategory(index)} className="w-full rounded-2xl border border-rose-200 bg-rose-50/50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 transition sm:w-auto">
                        Remove
                      </button>
                    </div>
                    <div className="mt-3">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                        <span>Spent {formatCurrency(spent)}</span>
                        <span>{Math.round(percent)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${percent >= 100 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:bg-slate-800">
              {budget.loading ? 'Saving...' : 'Save Budget'}
            </button>
          </form>
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Monthly Progress</h3>
          <p className="mt-1 text-sm text-slate-500">How close you are to the spending line.</p>
          <div className="mt-5 space-y-4">
            <div>
              <p className="text-sm text-slate-500">Spent</p>
              <p className="text-2xl font-semibold text-slate-900">{formatCurrency(totalExpense)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Remaining</p>
              <p className={`text-2xl font-semibold ${remaining < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(remaining)}</p>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                <span>Budget used</span>
                <span>{Math.round(usedPercent)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${usedPercent >= 100 ? 'bg-rose-500' : 'bg-sky-500'}`} style={{ width: `${usedPercent}%` }} />
              </div>
            </div>
            {remaining < 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">You are overspending. Trim flexible categories before month end.</div>}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Budget