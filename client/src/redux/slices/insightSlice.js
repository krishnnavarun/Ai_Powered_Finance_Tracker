import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as aiService from '../../services/aiService'

// helper: extract a readable message from an axios/network error
const getError = (error) => error.response?.data?.message || error.message || 'Something went wrong'

// thunk: fetchInsights → calls aiService.generateInsights, returns response.data.data, rejects with getError
export const fetchInsights = createAsyncThunk('insights/fetch', async (_, { rejectWithValue }) => {
  // try → call aiService.generateInsights(), return response.data.data
  // catch → return rejectWithValue(getError(error))
})

// thunk: fetchPrediction → calls aiService.predictSpending, returns response.data.data, rejects with getError
export const fetchPrediction = createAsyncThunk('insights/predict', async (_, { rejectWithValue }) => {
  // try → call aiService.predictSpending(), return response.data.data
  // catch → return rejectWithValue(getError(error))
})

const initialState = {
  insights: [],
  predictions: {},
  provider: '',
  loading: false,
  error: ''
}

const insightSlice = createSlice({
  name: 'insights',
  initialState,
  reducers: {
    // setInsights(state, action) → set state.insights = action.payload
    setInsights: (state, action) => {},

    // setPredictions(state, action) → set state.predictions = action.payload
    setPredictions: (state, action) => {},

    // setLoading(state, action) → set state.loading = action.payload
    setLoading: (state, action) => {}
  },
  extraReducers: (builder) => {
    // fetchInsights:
    //   pending   → loading = true, clear error
    //   fulfilled → loading = false, set insights (or []) and provider (fallback "heuristic")
    //   rejected  → loading = false, error = action.payload
    //
    // fetchPrediction:
    //   fulfilled → set predictions = action.payload
  }
})

export const { setInsights, setPredictions, setLoading } = insightSlice.actions
export default insightSlice.reducer