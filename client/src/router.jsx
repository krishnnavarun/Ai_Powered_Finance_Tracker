import { Navigate } from 'react-router';
import { FullPageLoader } from '@/components/common/FullPageLoader';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { GuestOnly, RequireAuth } from '@/features/auth/RouteGuards';
import { NAV_ITEMS } from '@/lib/navigation';
import { RouteErrorPage } from '@/pages/RouteErrorPage';

// Each page is downloaded only when it is first visited, keeping the initial load small.
// `lazyPage(() => import('./X'), 'X')` → loads the module and uses its named export.
function lazyPage(load, exportName) {
  return async () => ({ Component: (await load())[exportName] });
}

// Real pages replace the placeholder here as each checkpoint lands.
const PAGE_LOADERS = {
  '/dashboard': lazyPage(() => import('@/pages/DashboardPage'), 'DashboardPage'),
};
const placeholderPage = lazyPage(() => import('@/pages/PlaceholderPage'), 'PlaceholderPage');

const pageRoutes = NAV_ITEMS.map((item) => ({
  path: item.path,
  lazy: PAGE_LOADERS[item.path] ?? placeholderPage,
  handle: {
    title: item.label,
    description: item.description,
    icon: item.icon,
    checkpoint: item.checkpoint,
  },
}));

// Exported as plain data so tests can mount it in a memory router.
export const routes = [
  {
    errorElement: <RouteErrorPage />,
    // Shown while the first page's code is downloading.
    HydrateFallback: FullPageLoader,
    children: [
      // Public pages — only for logged-out visitors.
      {
        element: <GuestOnly />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              {
                path: '/login',
                lazy: lazyPage(() => import('@/pages/LoginPage'), 'LoginPage'),
                handle: { title: 'Log in' },
              },
              {
                path: '/register',
                lazy: lazyPage(() => import('@/pages/RegisterPage'), 'RegisterPage'),
                handle: { title: 'Create account' },
              },
            ],
          },
        ],
      },
      // The app — only for logged-in users.
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              // "/" becomes the public landing page in CP25; until then it opens the dashboard.
              { index: true, element: <Navigate to="/dashboard" replace /> },
              ...pageRoutes,
              {
                path: '*',
                lazy: lazyPage(() => import('@/pages/NotFoundPage'), 'NotFoundPage'),
                handle: { title: 'Not found' },
              },
            ],
          },
        ],
      },
    ],
  },
];
