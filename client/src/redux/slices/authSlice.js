import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as authService from '../../services/authService'

const getError = (error) => error.response?.data?.message || error.message || 'Something went wrong'

const persistUser = (user) => {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user))
  } else {
    localStorage.removeItem('user')
  }
}

const persistAuth = ({ token, user }) => {
  if (token) {
    localStorage.setItem('token', token)
  }

  persistUser(user)
}

const clearAuth = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export const loginUser = createAsyncThunk('auth/login', async (data, { rejectWithValue }) => {
  try {
    const response = await authService.login(data)
    return response.data
  } catch (error) {
    return rejectWithValue(getError(error))
  }
})

export const signupUser = createAsyncThunk('auth/signup', async (data, { rejectWithValue }) => {
  try {
    const response = await authService.signup(data)
    return response.data
  } catch (error) {
    return rejectWithValue(getError(error))
  }
})

export const refreshUser = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const response = await authService.getMe()
    return response.data.user
  } catch (error) {
    return rejectWithValue(getError(error))
  }
})

export const updateProfileThunk = createAsyncThunk('auth/updateProfile', async (data, { rejectWithValue }) => {
  try {
    const response = await authService.updateProfile(data)
    return response.data.user || response.data.data
  } catch (error) {
    return rejectWithValue(getError(error))
  }
})

const storedUser = localStorage.getItem('user')

const parseStoredUser = () => {
  if (!storedUser) {
    return null
  }

  try {
    return JSON.parse(storedUser)
  } catch (error) {
    localStorage.removeItem('user')
    return null
  }
}

const initialState = {
  user: parseStoredUser(),
  token: localStorage.getItem('token') || null,
  loading: false,
  error: '',
  isAuthenticated: !!localStorage.getItem('token')
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload
    },
    setUser: (state, action) => {
      const { token, user } = action.payload || {}
      state.user = user || null
      state.token = token || state.token
      state.isAuthenticated = !!(token || state.token)
      state.error = ''
      persistAuth({ token: token || state.token, user })
    },
    updateUser: (state, action) => {
      state.user = action.payload || null
      state.isAuthenticated = true
      persistUser(action.payload || null)
    },
    logout: (state) => {
      state.user = null
      state.token = null
      state.isAuthenticated = false
      state.loading = false
      state.error = ''
      clearAuth()
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true
        state.error = ''
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false
        state.error = ''
        state.user = action.payload.user || null
        state.token = action.payload.token || null
        state.isAuthenticated = !!action.payload.token
        persistAuth({ token: action.payload.token, user: action.payload.user })
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Unable to log in'
      })
      .addCase(signupUser.pending, (state) => {
        state.loading = true
        state.error = ''
      })
      .addCase(signupUser.fulfilled, (state, action) => {
        state.loading = false
        state.error = ''
        state.user = action.payload.user || null
        state.token = action.payload.token || null
        state.isAuthenticated = !!action.payload.token
        persistAuth({ token: action.payload.token, user: action.payload.user })
      })
      .addCase(signupUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Unable to create account'
      })
      .addCase(refreshUser.fulfilled, (state, action) => {
        state.user = action.payload || null
        state.isAuthenticated = true
        state.error = ''
        persistUser(action.payload || null)
      })
      .addCase(refreshUser.rejected, (state) => {
        state.user = null
        state.token = null
        state.isAuthenticated = false
        state.loading = false
        state.error = ''
        clearAuth()
      })
      .addCase(updateProfileThunk.pending, (state) => {
        state.loading = true
        state.error = ''
      })
      .addCase(updateProfileThunk.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload || null
        state.isAuthenticated = true
        state.error = ''
        persistUser(action.payload || null)
      })
      .addCase(updateProfileThunk.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Unable to update profile'
      })
  }
})

export const { setLoading, setUser, updateUser, logout } = authSlice.actions
export default authSlice.reducer