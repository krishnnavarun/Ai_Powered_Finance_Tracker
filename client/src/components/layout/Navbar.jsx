import { useSelector } from 'react-redux'

function Navbar() {
  // redux: { user } from state.auth

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="px-6 py-4 flex justify-between items-center">
        {/* "Finance Dashboard" heading */}
        <div className="flex items-center gap-4">
          {/* if user → name + email (text-right) */}
        </div>
      </div>
    </nav>
  )
}

export default Navbar