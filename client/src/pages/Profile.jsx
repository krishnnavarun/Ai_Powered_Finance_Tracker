import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { updateProfileThunk } from '../redux/slices/authSlice'
import { changePassword, getAccountStats } from '../services/authService'
import { formatCurrency } from '../utils/format'

function Profile() {
  // redux: dispatch, { user } from state.auth
  // state: profile ({ name, email }), passwords ({ currentPassword, newPassword }),
  //        stats, message, error (local)

  // useEffect (on user change) → sync profile from user, fetch account stats

  // saveProfile(event)  → preventDefault, dispatch updateProfileThunk,
  //                       set success message or error
  // savePassword(event) → preventDefault, call changePassword, reset password fields,
  //                       set success message or error

  return (
    <div className="space-y-6">
      <div>
        {/* Page heading + description */}
      </div>

      {/* if message → success banner */}
      {/* if error   → error banner */}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-lg border bg-white p-5 shadow-sm xl:col-span-2">
          {/* "User Details" heading */}
          <form onSubmit={saveProfile} className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Name input + Email input + Save Profile button */}
          </form>

          {/* "Change Password" heading */}
          <form onSubmit={savePassword} className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Current password input + New password input (minLength 6) + Change Password button */}
          </form>
        </section>

        <section className="rounded-lg border bg-white p-5 shadow-sm">
          {/* "Account Statistics" heading */}
          <div className="mt-4 space-y-4">
            {/* Transactions count */}
            {/* Income → formatCurrency(stats.totalIncome) */}
            {/* Expenses → formatCurrency(stats.totalExpense) */}
            {/* Savings → formatCurrency(stats.savings) */}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Profile