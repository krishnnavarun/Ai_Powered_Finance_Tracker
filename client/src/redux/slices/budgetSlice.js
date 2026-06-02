import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as budgetService from '../../services/budgetService'

const getError = (error) => error.response?.data?.message || error.message || 'Something went wrong'

export const fetchBudget = createAsyncThunk('budget/fetch', async (_, { rejectWithValue }) => {
  try {
    const response = await budgetService.getBudget()
    return response.data.data
  } catch (error) {
    return rejectWithValue(getError(error))
  }
})

export const saveBudget = createAsyncThunk('budget/save', async (data, { rejectWithValue }) => {
  try {
    const response = await budgetService.setBudget(data)
    return response.data.data
  } catch (error) {
    return rejectWithValue(getError(error))
  }
})

const initialState = {
  monthlyBudget: 0,
  categories: [],
  remaining: 0,
  loading: false,
  error: ''
}

const applyBudget = (state, payload) => {
  state.monthlyBudget = Number(payload?.monthlyBudget || 0)
  state.categories = payload?.categoryBudgets || payload?.categories || []
  state.remaining = Number(payload?.remaining ?? payload?.monthlyBudget ?? 0)
}

const budgetSlice = createSlice({
  name: 'budget',
  initialState,
  reducers: {
    setBudget: (state, action) => {
      applyBudget(state, action.payload)
    },
    setLoading: (state, action) => {
      state.loading = action.payload
    },
    updateRemaining: (state, action) => {
      state.remaining = action.payload
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBudget.pending, (state) => {
        state.loading = true
        state.error = ''
      })
      .addCase(fetchBudget.fulfilled, (state, action) => {
        state.loading = false
        applyBudget(state, action.payload)
      })
      .addCase(fetchBudget.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Unable to load budget'
      })
      .addCase(saveBudget.pending, (state) => {
        state.loading = true
        state.error = ''
      })
      .addCase(saveBudget.fulfilled, (state, action) => {
        state.loading = false
        applyBudget(state, action.payload)
      })
      .addCase(saveBudget.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Unable to save budget'
      })
  }
})

export const { setBudget, setLoading, updateRemaining } = budgetSlice.actions
export default budgetSlice.reducer