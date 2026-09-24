// Where to go after logging in: the page the user originally asked for (saved by
// RequireAuth in `location.state.from`), or the dashboard.
export function redirectTarget(from) {
  if (!from?.pathname || from.pathname === '/login' || from.pathname === '/register') {
    return '/dashboard';
  }
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}
