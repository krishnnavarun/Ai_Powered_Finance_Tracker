import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as aiService from '../../services/aiService'

const getError = (error) => error.response?.data?.message || error.message || 'Something went wrong'

export const fetchInsights = createAsyncThunk('insights/fetch', async (_, { rejectWithValue }) => {
  try {
    const response = await aiService.generateInsights()
    return response.data.data
  } catch (error) {
    return rejectWithValue(getError(error))
  }
})

export const fetchPrediction = createAsyncThunk('insights/predict', async (_, { rejectWithValue }) => {
  try {
    const response = await aiService.predictSpending()
    return response.data.data
  } catch (error) {
    return rejectWithValue(getError(error))
  }
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
    setInsights: (state, action) => {
      state.insights = action.payload || []
    },
    setPredictions: (state, action) => {
      state.predictions = action.payload || {}
    },
    setLoading: (state, action) => {
      state.loading = action.payload
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInsights.pending, (state) => {
        state.loading = true
        state.error = ''
      })
      .addCase(fetchInsights.fulfilled, (state, action) => {
        state.loading = false
        const result = action.payload || {}
        state.insights = Array.isArray(result.insights)
          ? result.insights
          : Array.isArray(result.recommendations)
            ? result.recommendations
            : []
        state.provider = result.provider || 'heuristic'
      })
      .addCase(fetchInsights.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Unable to generate insights'
      })
      .addCase(fetchPrediction.pending, (state) => {
        state.loading = true
        state.error = ''
      })
      .addCase(fetchPrediction.fulfilled, (state, action) => {
        state.loading = false
        state.predictions = action.payload || {}
      })
      .addCase(fetchPrediction.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Unable to generate prediction'
      })
  }
})

export const { setInsights, setPredictions, setLoading } = insightSlice.actions
export default insightSlice.reducer