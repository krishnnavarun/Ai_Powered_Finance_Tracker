import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchInsights, fetchPrediction } from '../redux/slices/insightSlice'
import { formatCurrency } from '../utils/format'

function Insights() {
  // redux: dispatch, { insights, predictions, provider, loading, error } from state.insights

  // useEffect (on mount) → dispatch(fetchInsights()) and dispatch(fetchPrediction())

  // refresh handler → re-dispatch fetchInsights and fetchPrediction (used by Refresh button)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          {/* Page heading + description */}
        </div>
        {/* Refresh Insights button → re-dispatches fetchInsights and fetchPrediction */}
      </div>

      {/* if error → error banner */}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-lg border bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            {/* "Recommendations" heading + provider badge (fallback: "heuristic") */}
          </div>
          {/* if loading → "Generating insights..." text
              else → list of insight cards, or "Add transactions to generate insights." if empty */}
        </section>

        <section className="rounded-lg border bg-white p-5 shadow-sm">
          {/* "Spending Prediction" heading */}
          <div className="mt-5 space-y-4">
            <div>
              {/* Predicted Expense → formatCurrency(predictions.predictedExpense) */}
            </div>
            <div>
              {/* Confidence label + progress bar (width = predictions.confidence%) + percent text */}
            </div>
            {/* if predictions.budgetRisk → amber alert: "Predicted spending is above your monthly budget." */}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Insights