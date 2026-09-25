import {
  ArrowLeftRight,
  ChartColumn,
  LayoutDashboard,
  Lightbulb,
  PiggyBank,
  Repeat,
  Settings,
  Sparkles,
  Target,
  Wallet,
} from 'lucide-react';

// Single source of truth for app pages: used by the router, sidebar and mobile nav.
// `mobile: true` puts the page in the bottom bar on phones; the rest go under "More".
export const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      {
        path: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        mobile: true,
        description: 'Your money today',
      },
      {
        path: '/transactions',
        label: 'Transactions',
        icon: ArrowLeftRight,
        mobile: true,
        description: 'Money in and money out',
      },
      {
        path: '/wallets',
        label: 'Wallets',
        icon: Wallet,
        description: 'Where your money is kept',
      },
    ],
  },
  {
    label: 'Plan',
    items: [
      {
        path: '/budgets',
        label: 'Budgets',
        icon: PiggyBank,
        mobile: true,
        description: 'How much you plan to spend',
      },
      {
        path: '/goals',
        label: 'Goals',
        icon: Target,
        description: 'Things you are saving for',
      },
      {
        // Rules the user sets up + subscriptions found in their payments.
        path: '/recurring',
        label: 'Recurring',
        icon: Repeat,
        description: 'Payments that repeat',
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        path: '/reports',
        label: 'Reports',
        icon: ChartColumn,
        description: 'Your spending in charts',
      },
      {
        path: '/insights',
        label: 'Insights',
        icon: Lightbulb,
        description: 'Tips and warnings for you',
      },
      {
        path: '/assistant',
        label: 'Assistant',
        icon: Sparkles,
        mobile: true,
        description: 'Ask questions about your money',
      },
    ],
  },
];

export const SETTINGS_ITEM = {
  path: '/settings',
  label: 'Settings',
  icon: Settings,
  description: 'Your account and privacy',
};

export const NAV_ITEMS = [...NAV_SECTIONS.flatMap((section) => section.items), SETTINGS_ITEM];

export const MOBILE_ITEMS = NAV_ITEMS.filter((item) => item.mobile);
export const MORE_ITEMS = NAV_ITEMS.filter((item) => !item.mobile);
