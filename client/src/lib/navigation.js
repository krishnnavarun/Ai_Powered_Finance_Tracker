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
// `checkpoint` is the build checkpoint that turns the placeholder into the real page.
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
        checkpoint: 'CP11',
      },
      {
        path: '/transactions',
        label: 'Transactions',
        icon: ArrowLeftRight,
        mobile: true,
        description: 'Money in and money out',
        checkpoint: 'CP9',
      },
      {
        path: '/wallets',
        label: 'Wallets',
        icon: Wallet,
        description: 'Where your money is kept',
        checkpoint: 'CP9',
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
        checkpoint: 'CP11',
      },
      {
        path: '/goals',
        label: 'Goals',
        icon: Target,
        description: 'Things you are saving for',
        checkpoint: 'CP11',
      },
      {
        path: '/subscriptions',
        label: 'Subscriptions',
        icon: Repeat,
        description: 'Payments that repeat',
        checkpoint: 'CP20',
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
        checkpoint: 'CP12',
      },
      {
        path: '/insights',
        label: 'Insights',
        icon: Lightbulb,
        description: 'Tips and warnings for you',
        checkpoint: 'CP20',
      },
      {
        path: '/assistant',
        label: 'Assistant',
        icon: Sparkles,
        mobile: true,
        description: 'Ask questions about your money',
        checkpoint: 'CP22',
      },
    ],
  },
];

export const SETTINGS_ITEM = {
  path: '/settings',
  label: 'Settings',
  icon: Settings,
  description: 'Your account and privacy',
  checkpoint: 'CP24',
};

export const NAV_ITEMS = [...NAV_SECTIONS.flatMap((section) => section.items), SETTINGS_ITEM];

export const MOBILE_ITEMS = NAV_ITEMS.filter((item) => item.mobile);
export const MORE_ITEMS = NAV_ITEMS.filter((item) => !item.mobile);
