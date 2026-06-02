import { useEffect, useState } from 'react'
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

function Dashboard() {
  // state: summary, loading (initial true), error (local)

  // useEffect (on mount) → call getDashboardSummary, set summary on success,
  //                        set error on failure, set loading false in finally

  // early return: if loading → "Loading dashboard..." text
  // early return: if error   → error banner

  // derived values:
  // trend          → summary.monthlyTrend (or [])
  // categories     → summary.categoryBreakdown (or [])
  // incomeExpense  → trend mapped to { month, Income, Expense }

  return (
    <div className="space-y-6">
      <div>
        {/* Page heading + description */}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* SummaryCard × 4 → Total Income, Total Expense, Remaining Budget, Savings */}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-lg border bg-white p-5 shadow-sm xl:col-span-2">
          {/* "Monthly Spending Trend" heading */}
          <div className="mt-4 h-72">
            {/* LineChart (recharts) → expense over months from `trend` */}
          </div>
        </section>

        <section className="rounded-lg border bg-white p-5 shadow-sm">
          {/* "Category Distribution" heading */}
          <div className="mt-4 h-72">
            {/* PieChart (recharts) → categories with COLORS palette */}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-lg border bg-white p-5 shadow-sm xl:col-span-2">
          {/* "Income vs Expense" heading */}
          <div className="mt-4 h-72">
            {/* BarChart (recharts) → Income (green) and Expense (red) bars from `incomeExpense` */}
          </div>
        </section>

        <section className="rounded-lg border bg-white p-5 shadow-sm">
          {/* "Recent Transactions" heading */}
          <div className="mt-4 space-y-3">
            {/* if summary.recentTransactions has items → list them (title, category • date, signed amount)
                else → "No transactions yet." */}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Dashboard