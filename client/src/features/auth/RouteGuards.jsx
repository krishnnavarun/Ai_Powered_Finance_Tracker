import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageLoader } from '@/components/common/FullPageLoader';
import { useAuthStore } from '@/store/auth';
import { redirectTarget } from './redirect';

// Wraps pages that need a logged-in user. Logged-out visitors go to /login; the page
// they wanted is remembered in `state.from` so login can send them back — except after
// an explicit logout, when the next login should simply start at the dashboard.
export function RequireAuth() {
  const status = useAuthStore((state) => state.status);
  const endReason = useAuthStore((state) => state.endReason);
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader />;
  if (status === 'anonymous') {
    const state = endReason === 'logout' ? undefined : { from: location };
    return <Navigate to="/login" replace state={state} />;
  }
  return <Outlet />;
}

// Wraps login / register. Logged-in users are sent into the app.
export function GuestOnly() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated') {
    return <Navigate to={redirectTarget(location.state?.from)} replace />;
  }
  return <Outlet />;
}
