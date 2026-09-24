import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageLoader } from '@/components/common/FullPageLoader';
import { useAuthStore } from '@/store/auth';

// Wraps pages that need a logged-in user. Logged-out visitors go to /login; the page
// they wanted is remembered in `state.from` so login can send them back.
export function RequireAuth() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

// Wraps login / register. Already logged-in users are sent into the app.
export function GuestOnly() {
  const status = useAuthStore((state) => state.status);

  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
