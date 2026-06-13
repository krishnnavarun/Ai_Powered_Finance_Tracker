import axios from 'axios'

// Ensure the configured API URL includes the `/api` prefix so requests
// like `/auth/signup` always reach the API routes in production.
const rawBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const normalizedBase = rawBase.replace(/\/+$/g, '') // strip trailing slashes
const baseURL = normalizedBase.endsWith('/api') ? normalizedBase : `${normalizedBase}/api`

const API = axios.create({ baseURL })

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }

    return Promise.reject(error)
  }
)

export default API