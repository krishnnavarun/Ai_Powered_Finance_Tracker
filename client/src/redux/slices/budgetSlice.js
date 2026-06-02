import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as budgetService from '../../services/budgetService'

// helper: extract a readable message from an axios/network error
const getError = (error) => error.response?.data?.message || error.message || 'Something went wrong'

// thunk: fetchBudget → calls budgetService.getBudget, returns response.data.data, rejects with getError
export const fetchBudget = createAsyncThunk('budget/fetch', async (_, { rejectWithValue }) => {
  // try → call budgetService.getBudget(), return response.data.data
  // catch → return rejectWithValue(getError(error))
})

// thunk: saveBudget → calls budgetService.setBudget, returns response.data.data, rejects with getError
export const saveBudget = createAsyncThunk('budget/save', async (data, { rejectWithValue }) => {
  // try → call budgetService.setBudget(data), return response.data.data
  // catch → return rejectWithValue(getError(error))
})

const initialState = {
  monthlyBudget: 0,
  categories: [],
  remaining: 0,
  loading: false,
  error: ''
}

const budgetSlice = createSlice({
  name: 'budget',
  initialState,
  reducers: {
    // setBudget(state, action) → set monthlyBudget, categories (from categoryBudgets), remaining
    setBudget: (state, action) => {},

    // setLoading(state, action) → set state.loading = action.payload
    setLoading: (state, action) => {},

    // updateRemaining(state, action) → set state.remaining = action.payload
    updateRemaining: (state, action) => {}
  },
  extraReducers: (builder) => {
    // fetchBudget:
    //   pending   → loading = true, clear error
    //   fulfilled → loading = false, set monthlyBudget / categories / remaining from payload
    //   rejected  → loading = false, error = action.payload
    //
    // saveBudget:
    //   fulfilled → set monthlyBudget / categories / remaining from payload
  }
})

export const { setBudget, setLoading, updateRemaining } = budgetSlice.actions
export default budgetSlice.reducer