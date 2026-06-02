import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { signupUser } from '../redux/slices/authSlice'

function Signup() {
  // state: formData ({ name, email, password, confirmPassword }), error (local)
  // redux: { loading } from state.auth
  // hooks: navigate (react-router), dispatch (redux)

  // handleChange(e) → update formData field by input name
  // handleSubmit(e) → preventDefault, validate password === confirmPassword,
  //                   dispatch signupUser with { name, email, password },
  //                   navigate to /dashboard on success, set error on failure

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        {/* App title: "FinTrack" */}

        {/* if error → red error banner */}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            {/* Full Name label + text input (controlled, required) */}
          </div>

          <div className="mb-4">
            {/* Email label + email input (controlled, required) */}
          </div>

          <div className="mb-4">
            {/* Password label + password input (controlled, required) */}
          </div>

          <div className="mb-6">
            {/* Confirm Password label + password input (controlled, required) */}
          </div>

          {/* Submit button → shows "Creating account..." when loading, else "Sign Up" */}
        </form>

        {/* "Already have an account?" text + Link to /login */}
      </div>
    </div>
  )
}

export default Signup