import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as authService from '../../services/authService'

// helper: extract a readable message from an axios/network error
const getError = (error) => error.response?.data?.message || error.message || 'Something went wrong'

// thunk: loginUser → calls authService.login, returns response.data, rejects with getError
export const loginUser = createAsyncThunk('auth/login', async (data, { rejectWithValue }) => {
  // try → call authService.login(data), return response.data
  // catch → return rejectWithValue(getError(error))
})

// thunk: signupUser → calls authService.signup, returns response.data, rejects with getError
export const signupUser = createAsyncThunk('auth/signup', async (data, { rejectWithValue }) => {
  // try → call authService.signup(data), return response.data
  // catch → return rejectWithValue(getError(error))
})

// thunk: refreshUser → calls authService.getMe, returns response.data.user, rejects with getError
export const refreshUser = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  // try → call authService.getMe(), return response.data.user
  // catch → return rejectWithValue(getError(error))
})

// thunk: updateProfileThunk → calls authService.updateProfile, returns response.data.user, rejects with getError
export const updateProfileThunk = createAsyncThunk('auth/updateProfile', async (data, { rejectWithValue }) => {
  // try → call authService.updateProfile(data), return response.data.user
  // catch → return rejectWithValue(getError(error))
})

// read raw user JSON from localStorage (may be null)
const storedUser = localStorage.getItem('user')

// parseStoredUser() → safely JSON.parse storedUser; on failure remove it and return null
const parseStoredUser = () => {
  // if !storedUser → return null
  // try JSON.parse(storedUser); catch → remove "user" from localStorage and return null
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
    // setLoading(state, action) → set state.loading = action.payload
    setLoading: (state, action) => {},

    // setUser(state, action) → set user/token/isAuthenticated; persist token & user to localStorage
    setUser: (state, action) => {},

    // updateUser(state, action) → replace user, mark authenticated, persist user to localStorage
    updateUser: (state, action) => {},

    // logout(state) → clear user/token/isAuthenticated/error and remove both from localStorage
    logout: (state) => {}
  },
  extraReducers: (builder) => {
    // loginUser:
    //   pending   → loading = true, clear error
    //   fulfilled → store user/token, mark authenticated, persist to localStorage
    //   rejected  → loading = false, error = action.payload
    //
    // signupUser:
    //   pending   → loading = true, clear error
    //   fulfilled → store user/token, mark authenticated, persist to localStorage
    //   rejected  → loading = false, error = action.payload
    //
    // refreshUser:
    //   fulfilled → set user, mark authenticated, persist user
    //   rejected  → clear user/token/auth, remove both from localStorage
    //
    // updateProfileThunk:
    //   fulfilled → set user and persist to localStorage
  }
})

export const { setLoading, setUser, updateUser, logout } = authSlice.actions
export default authSlice.reducer