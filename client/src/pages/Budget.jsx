import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchBudget, saveBudget } from '../redux/slices/budgetSlice'
import { getDashboardSummary } from '../services/dashboardService'
import { categories, formatCurrency } from '../utils/format'

function Budget() {
  // redux: dispatch, budget (from state.budget)
  // state: monthlyBudget, categoryBudgets, summary, message (local)

  // useEffect (on mount) → dispatch(fetchBudget()) and load dashboard summary
  // useEffect (on budget change) → sync monthlyBudget and categoryBudgets from redux

  // addCategory()              → append a new { category, limit } entry to categoryBudgets
  // updateCategory(i, field, value) → update a specific field of a category at index i
  // removeCategory(i)          → remove the category at index i
  // save(event)                → dispatch saveBudget, refresh summary, set success message

  // derived values:
  // totalExpense → summary.totalExpense (or 0)
  // remaining    → monthlyBudget - totalExpense
  // usedPercent  → (totalExpense / monthlyBudget) * 100, capped at 100

  return (
    <div className="space-y-6">
      <div>
        {/* Page heading + description */}
      </div>

      {/* if message → success banner */}
      {/* if budget.error → error banner */}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-lg border bg-white p-5 shadow-sm xl:col-span-2">
          <form onSubmit={save} className="space-y-5">
            <div>
              {/* Monthly Budget label + number input */}
            </div>

            <div className="flex items-center justify-between">
              {/* "Category Budgets" heading + Add Category button */}
            </div>

            <div className="space-y-3">
              {/* map over categoryBudgets → for each item:
                  - compute spent (from summary.categoryBreakdown) and percent
                  - category select (options from `categories`)
                  - limit number input
                  - Remove button
                  - progress bar (red if percent >= 100, else green) */}
            </div>

            {/* Save Budget button → shows "Saving..." while budget.loading */}
          </form>
        </section>

        <section className="rounded-lg border bg-white p-5 shadow-sm">
          {/* "Monthly Progress" heading */}
          <div className="mt-5 space-y-4">
            <div>
              {/* Spent → totalExpense */}
            </div>
            <div>
              {/* Remaining → red if negative, green otherwise */}
            </div>
            <div>
              {/* Budget used progress bar with usedPercent (red if >= 100, else sky) */}
            </div>
            {/* if remaining < 0 → overspending alert */}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Budget