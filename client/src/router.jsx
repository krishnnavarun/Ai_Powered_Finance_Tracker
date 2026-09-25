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

// Every page in the menu (lib/navigation.js) needs its loader here.
const PAGE_LOADERS = {
  '/dashboard': lazyPage(() => import('@/pages/DashboardPage'), 'DashboardPage'),
  '/transactions': lazyPage(() => import('@/pages/TransactionsPage'), 'TransactionsPage'),
  '/wallets': lazyPage(() => import('@/pages/WalletsPage'), 'WalletsPage'),
  '/budgets': lazyPage(() => import('@/pages/BudgetsPage'), 'BudgetsPage'),
  '/goals': lazyPage(() => import('@/pages/GoalsPage'), 'GoalsPage'),
  '/recurring': lazyPage(() => import('@/pages/RecurringPage'), 'RecurringPage'),
  '/reports': lazyPage(() => import('@/pages/ReportsPage'), 'ReportsPage'),
  '/insights': lazyPage(() => import('@/pages/InsightsPage'), 'InsightsPage'),
  '/assistant': lazyPage(() => import('@/pages/AssistantPage'), 'AssistantPage'),
  '/settings': lazyPage(() => import('@/pages/SettingsPage'), 'SettingsPage'),
};

const pageRoutes = NAV_ITEMS.map((item) => ({
  path: item.path,
  lazy: PAGE_LOADERS[item.path],
  handle: {
    title: item.label,
    description: item.description,
    icon: item.icon,
  },
}));

// Exported as plain data so tests can mount it in a memory router.
export const routes = [
  {
    errorElement: <RouteErrorPage />,
    // Shown while the first page's code is downloading.
    HydrateFallback: FullPageLoader,
    children: [
      // The home page: for visitors; logged-in users go on to their dashboard.
      {
        index: true,
        lazy: lazyPage(() => import('@/pages/LandingPage'), 'LandingPage'),
        handle: { title: 'Track your money with AI' },
      },
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
            path: '/onboarding',
            lazy: lazyPage(() => import('@/pages/OnboardingPage'), 'OnboardingPage'),
            handle: { title: 'Welcome' },
          },
          {
            element: <AppLayout />,
            children: [
              ...pageRoutes,
              // Reached from the Transactions page, so it isn't in the menu.
              {
                path: '/import',
                lazy: lazyPage(() => import('@/pages/ImportPage'), 'ImportPage'),
                handle: { title: 'Import statement' },
              },
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
