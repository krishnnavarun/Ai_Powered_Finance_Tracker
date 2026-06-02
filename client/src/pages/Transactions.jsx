import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchTransactions,
  removeTransactionById,
  saveTransaction
} from '../redux/slices/transactionSlice'
import { categories, formatCurrency, formatDate, paymentMethods } from '../utils/format'

const emptyForm = {
  type: 'expense',
  title: '',
  amount: '',
  category: 'Food',
  paymentMethod: 'upi',
  description: '',
  transactionDate: new Date().toISOString().slice(0, 10)
}

const sortOptions = [
  { label: 'Latest', value: 'latest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Amount high → low', value: 'amount_desc' },
  { label: 'Amount low → high', value: 'amount_asc' }
]

const typeLabel = (value) => (value === 'income' ? 'Income' : 'Expense')
const prettyText = (value) => value?.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) || '-'

function Transactions() {
  const dispatch = useDispatch()
  const { transactions, pagination, loading, error } = useSelector((state) => state.transactions)
  const [filters, setFilters] = useState({ search: '', type: '', category: '', sort: 'latest', page: 1 })
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')

  const query = useMemo(
    () => ({
      page: filters.page,
      limit: 10,
      search: filters.search || undefined,
      type: filters.type || undefined,
      category: filters.category || undefined,
      sort: filters.sort
    }),
    [filters]
  )

  useEffect(() => {
    dispatch(fetchTransactions(query))
  }, [dispatch, query])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (item) => {
    setEditingId(item._id)
    setForm({
      type: item.type,
      title: item.title || '',
      amount: item.amount || '',
      category: item.category || 'Food',
      paymentMethod: item.paymentMethod || 'upi',
      description: item.description || '',
      transactionDate: item.transactionDate ? new Date(item.transactionDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
    })
    setShowForm(true)
  }

  const submitForm = async (event) => {
    event.preventDefault()
    setMessage('')

    try {
      await dispatch(saveTransaction({ id: editingId, data: form })).unwrap()
      setMessage(`Transaction ${editingId ? 'updated' : 'created'} successfully.`)
      setShowForm(false)
      setEditingId(null)
      dispatch(fetchTransactions(query))
    } catch (saveError) {
      setMessage(saveError)
    }
  }

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete ${item.title}?`)) {
      return
    }

    try {
      await dispatch(removeTransactionById(item._id)).unwrap()
      setMessage('Transaction deleted successfully.')
      dispatch(fetchTransactions(query))
    } catch (deleteError) {
      setMessage(deleteError)
    }
  }

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value, page: 1 }))
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Transactions</h2>
          <p className="mt-1 text-sm text-slate-500">Add income, capture expenses, and keep your ledger in sync with the backend.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:bg-slate-800"
        >
          Add Transaction
        </button>
      </div>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <input
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
            placeholder="Search title, category, or note"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
          <select
            value={filters.type}
            onChange={(event) => updateFilter('type', event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          >
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select
            value={filters.category}
            onChange={(event) => updateFilter('category', event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            value={filters.sort}
            onChange={(event) => updateFilter('sort', event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setFilters({ search: '', type: '', category: '', sort: 'latest', page: 1 })}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Reset Filters
          </button>
        </div>
      </section>

      {(error || message) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || message}
        </div>
      )}

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white/90 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-5 py-4 font-semibold">Title</th>
                <th className="px-5 py-4 font-semibold">Type</th>
                <th className="px-5 py-4 font-semibold">Category</th>
                <th className="px-5 py-4 font-semibold">Date</th>
                <th className="px-5 py-4 font-semibold">Payment</th>
                <th className="px-5 py-4 font-semibold">Amount</th>
                <th className="px-5 py-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-500" colSpan="7">
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length ? (
                transactions.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.description || 'No description provided'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {typeLabel(item.type)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{item.category}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(item.transactionDate)}</td>
                    <td className="px-5 py-4 text-slate-600">{prettyText(item.paymentMethod)}</td>
                    <td className={`px-5 py-4 font-semibold ${item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => openEdit(item)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                          Edit
                        </button>
                        <button type="button" onClick={() => deleteItem(item)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-500" colSpan="7">
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Page {pagination.page} of {pagination.pages || 1} · {pagination.total || 0} transactions
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
              className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.pages}
              onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
              className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {showForm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold text-slate-900">{editingId ? 'Edit transaction' : 'Add transaction'}</h3>
                <p className="mt-1 text-sm text-slate-500">Saved directly through the transactions endpoint.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                Close
              </button>
            </div>

            <form onSubmit={submitForm} className="mt-6 grid gap-4 md:grid-cols-2">
              <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100">
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required placeholder="Title" className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
              <input value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required type="number" min="0" placeholder="Amount" className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
              <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100">
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100">
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>{prettyText(method)}</option>
                ))}
              </select>
              <input value={form.transactionDate} onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))} type="date" className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
              <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows="4" placeholder="Description" className="md:col-span-2 rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />

              <div className="md:col-span-2 flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">
                  Cancel
                </button>
                <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:bg-slate-800">
                  {loading ? 'Saving...' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Transactions