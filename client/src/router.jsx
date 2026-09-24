import { Navigate } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { GuestOnly, RequireAuth } from '@/features/auth/RouteGuards';
import { NAV_ITEMS } from '@/lib/navigation';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';

// Real pages replace PlaceholderPage here as each checkpoint lands.
const PAGE_COMPONENTS = {
  '/dashboard': DashboardPage,
};

const pageRoutes = NAV_ITEMS.map((item) => {
  const Page = PAGE_COMPONENTS[item.path] ?? PlaceholderPage;
  return {
    path: item.path,
    element: <Page />,
    handle: {
      title: item.label,
      description: item.description,
      icon: item.icon,
      checkpoint: item.checkpoint,
    },
  };
});

// Exported as plain data so tests can mount it in a memory router.
export const routes = [
  {
    errorElement: <RouteErrorPage />,
    children: [
      // Public pages — only for logged-out visitors.
      {
        element: <GuestOnly />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: '/login', element: <LoginPage />, handle: { title: 'Log in' } },
              { path: '/register', element: <RegisterPage />, handle: { title: 'Create account' } },
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
              { path: '*', element: <NotFoundPage />, handle: { title: 'Not found' } },
            ],
          },
        ],
      },
    ],
  },
];
