import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as transactionService from '../../services/transactionService'

// helper: extract a readable message from an axios/network error
const getError = (error) => error.response?.data?.message || error.message || 'Something went wrong'

// thunk: fetchTransactions → calls transactionService.getTransactions(params),
//                            returns response.data, rejects with getError
export const fetchTransactions = createAsyncThunk('transactions/fetch', async (params, { rejectWithValue }) => {
  // try → call transactionService.getTransactions(params), return response.data
  // catch → return rejectWithValue(getError(error))
})

// thunk: saveTransaction → if id present → updateTransaction(id, data), else createTransaction(data);
//                          returns response.data.data, rejects with getError
export const saveTransaction = createAsyncThunk('transactions/save', async ({ id, data }, { rejectWithValue }) => {
  // try → call updateTransaction(id, data) when id, else createTransaction(data); return response.data.data
  // catch → return rejectWithValue(getError(error))
})

// thunk: removeTransactionById → calls transactionService.deleteTransaction(id),
//                                returns the id, rejects with getError
export const removeTransactionById = createAsyncThunk('transactions/delete', async (id, { rejectWithValue }) => {
  // try → call transactionService.deleteTransaction(id), return id
  // catch → return rejectWithValue(getError(error))
})

const initialState = {
  transactions: [],
  pagination: { page: 1, limit: 10, total: 0, pages: 1 },
  loading: false,
  error: '',
  filters: {},
  selectedTransaction: null
}

const transactionSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    // setTransactions(state, action) → set state.transactions = action.payload
    setTransactions: (state, action) => {},

    // setLoading(state, action) → set state.loading = action.payload
    setLoading: (state, action) => {},

    // setFilters(state, action) → set state.filters = action.payload
    setFilters: (state, action) => {},

    // setSelectedTransaction(state, action) → set state.selectedTransaction = action.payload
    setSelectedTransaction: (state, action) => {},

    // addTransaction(state, action) → prepend action.payload to state.transactions
    addTransaction: (state, action) => {},

    // updateTransaction(state, action) → find by _id and replace with action.payload
    updateTransaction: (state, action) => {},

    // removeTransaction(state, action) → filter out transaction whose _id matches action.payload
    removeTransaction: (state, action) => {}
  },
  extraReducers: (builder) => {
    // fetchTransactions:
    //   pending   → loading = true, clear error
    //   fulfilled → loading = false, set transactions and pagination from payload
    //   rejected  → loading = false, error = action.payload
    //
    // saveTransaction:
    //   pending   → loading = true, clear error
    //   fulfilled → loading = false; if exists by _id → replace, else prepend
    //   rejected  → loading = false, error = action.payload
    //
    // removeTransactionById:
    //   fulfilled → filter out transaction whose _id matches action.payload
  }
})

export const {
  setTransactions,
  setLoading,
  setFilters,
  setSelectedTransaction,
  addTransaction,
  updateTransaction,
  removeTransaction
} = transactionSlice.actions
export default transactionSlice.reducer