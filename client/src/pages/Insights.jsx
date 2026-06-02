import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchInsights, fetchPrediction } from '../redux/slices/insightSlice'
import { formatCurrency } from '../utils/format'

function Insights() {
  const dispatch = useDispatch()
  const { insights, predictions, provider, loading, error } = useSelector((state) => state.insights)

  useEffect(() => {
    dispatch(fetchInsights())
    dispatch(fetchPrediction())
  }, [dispatch])

  const refresh = () => {
    dispatch(fetchInsights())
    dispatch(fetchPrediction())
  }

  const predictedExpense = predictions?.predictedExpense || 0
  const confidence = predictions?.confidence || 0
  const riskFlag = predictions?.budgetRisk || (predictedExpense > 0 && predictions?.budgetRemaining !== undefined ? predictions.predictedExpense > predictions.budgetRemaining : false)

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">AI Insights</h2>
          <p className="mt-1 text-sm text-slate-500">Backend-generated insights and spending prediction from your transaction history.</p>
        </div>
        <button onClick={refresh} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:bg-slate-800">
          Refresh Insights
        </button>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Recommendations</h3>
              <p className="text-sm text-slate-500">Powered by {provider || 'heuristic'} analysis.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
              {provider || 'heuristic'}
            </span>
          </div>
          {loading ? (
            <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">Generating insights...</div>
          ) : insights.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {insights.map((item, index) => (
                <article key={`${item}-${index}`} className="rounded-3xl border border-slate-200 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Insight {index + 1}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{item}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">Add transactions to generate insights.</div>
          )}
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Spending Prediction</h3>
          <p className="text-sm text-slate-500">Projected expense for the current month.</p>
          <div className="mt-5 space-y-4">
            <div>
              <p className="text-sm text-slate-500">Predicted Expense</p>
              <p className="text-3xl font-semibold text-slate-900">{formatCurrency(predictedExpense)}</p>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                <span>Confidence</span>
                <span>{Math.round(confidence)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-cyan-500" style={{ width: `${confidence}%` }} />
              </div>
            </div>
            {riskFlag && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">Predicted spending is above your monthly budget.</div>}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Insights