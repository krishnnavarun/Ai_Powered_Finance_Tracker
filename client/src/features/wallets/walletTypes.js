// Wallet types the API accepts, with a label and default icon for each.
export const WALLET_TYPES = [
  { value: 'bank', label: 'Bank account', icon: 'landmark' },
  { value: 'cash', label: 'Cash', icon: 'banknote' },
  { value: 'upi', label: 'UPI / e-wallet', icon: 'smartphone' },
  { value: 'card', label: 'Credit card', icon: 'credit-card' },
  { value: 'savings', label: 'Savings', icon: 'piggy-bank' },
  { value: 'other', label: 'Other', icon: 'wallet' },
];

export function walletTypeLabel(type) {
  return WALLET_TYPES.find((option) => option.value === type)?.label ?? type;
}

export function walletTypeIcon(type) {
  return WALLET_TYPES.find((option) => option.value === type)?.icon ?? 'wallet';
}

// Colour choices offered in the wallet form.
export const WALLET_COLORS = [
  '#0f766e',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#475569',
];
