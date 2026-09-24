// Default categories every new user starts with. `icon` is a lucide-react icon name.
// `key` becomes Category.systemKey — never change an existing key.
export const DEFAULT_CATEGORIES = [
  // Expense
  {
    key: 'food_dining',
    name: 'Food & Dining',
    type: 'expense',
    icon: 'utensils',
    color: '#f97316',
  },
  {
    key: 'groceries',
    name: 'Groceries',
    type: 'expense',
    icon: 'shopping-basket',
    color: '#84cc16',
  },
  { key: 'transport', name: 'Transport', type: 'expense', icon: 'car', color: '#0ea5e9' },
  { key: 'fuel', name: 'Fuel', type: 'expense', icon: 'fuel', color: '#f59e0b' },
  { key: 'rent', name: 'Rent', type: 'expense', icon: 'house', color: '#8b5cf6' },
  { key: 'utilities', name: 'Utilities', type: 'expense', icon: 'zap', color: '#eab308' },
  {
    key: 'mobile_internet',
    name: 'Mobile & Internet',
    type: 'expense',
    icon: 'smartphone',
    color: '#06b6d4',
  },
  { key: 'shopping', name: 'Shopping', type: 'expense', icon: 'shopping-bag', color: '#ec4899' },
  {
    key: 'entertainment',
    name: 'Entertainment',
    type: 'expense',
    icon: 'clapperboard',
    color: '#a855f7',
  },
  {
    key: 'subscriptions',
    name: 'Subscriptions',
    type: 'expense',
    icon: 'repeat',
    color: '#6366f1',
  },
  { key: 'health', name: 'Health', type: 'expense', icon: 'heart-pulse', color: '#ef4444' },
  {
    key: 'education',
    name: 'Education',
    type: 'expense',
    icon: 'graduation-cap',
    color: '#3b82f6',
  },
  { key: 'travel', name: 'Travel', type: 'expense', icon: 'plane', color: '#14b8a6' },
  {
    key: 'personal_care',
    name: 'Personal Care',
    type: 'expense',
    icon: 'sparkles',
    color: '#f472b6',
  },
  { key: 'gifts', name: 'Gifts', type: 'expense', icon: 'gift', color: '#e11d48' },
  { key: 'emi_loans', name: 'EMI/Loans', type: 'expense', icon: 'landmark', color: '#64748b' },
  {
    key: 'investments',
    name: 'Investments',
    type: 'expense',
    icon: 'trending-up',
    color: '#10b981',
  },
  {
    key: 'other_expense',
    name: 'Other',
    type: 'expense',
    icon: 'circle-ellipsis',
    color: '#94a3b8',
  },
  // Income
  { key: 'salary', name: 'Salary', type: 'income', icon: 'briefcase', color: '#16a34a' },
  { key: 'freelance', name: 'Freelance', type: 'income', icon: 'laptop', color: '#0d9488' },
  { key: 'pocket_money', name: 'Pocket Money', type: 'income', icon: 'wallet', color: '#65a30d' },
  { key: 'refund', name: 'Refund', type: 'income', icon: 'undo-2', color: '#0891b2' },
  { key: 'interest', name: 'Interest', type: 'income', icon: 'percent', color: '#059669' },
  {
    key: 'other_income',
    name: 'Other Income',
    type: 'income',
    icon: 'circle-plus',
    color: '#22c55e',
  },
];

// Category documents for one user, in display order.
export function defaultCategoriesFor(userId) {
  return DEFAULT_CATEGORIES.map(({ key, ...category }, index) => ({
    ...category,
    userId,
    systemKey: key,
    sortOrder: (index + 1) * 10,
  }));
}
