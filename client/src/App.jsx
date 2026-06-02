import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import './App.css'

// Pages
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Budget from './pages/Budget'
import Insights from './pages/Insights'
import Reports from './pages/Reports'
import Profile from './pages/Profile'

// Layout
import Layout from './components/layout/Layout'

// Redux
import { useDispatch, useSelector } from 'react-redux'
import { refreshUser } from './redux/slices/authSlice'

// ProtectedRoute → reads { isAuthenticated } from state.auth;
//                  renders <Outlet /> when authenticated, else <Navigate to="/login" replace />
function ProtectedRoute() {
  // ...
}

function App() {
  // redux: dispatch

  // useEffect (on mount) → if token exists in localStorage → dispatch(refreshUser())

  return (
    <Router>
      <Routes>
        {/* Public routes: /login, /signup */}

        {/* Protected routes (wrapped in <ProtectedRoute /> and <Layout />):
            /dashboard, /transactions, /budget, /insights, /reports, /profile
            "/" → redirect to /dashboard */}

        {/* Catch-all "*" → redirect to /dashboard */}
      </Routes>
    </Router>
  )
}

export default App