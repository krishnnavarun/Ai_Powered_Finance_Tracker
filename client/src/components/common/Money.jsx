import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

// Displays an amount stored in paise. `tone` colours income/expense, but the sign
// is always shown too, so colour is never the only signal.
export function Money({ paise, tone, decimals, className }) {
  const toneClass = tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : '';
  const sign = tone === 'income' ? '+' : tone === 'expense' ? '−' : '';
  const amount = formatMoney(tone ? Math.abs(paise) : paise, { decimals });

  return (
    <span className={cn('tabular-nums', toneClass, className)}>
      {sign}
      {amount}
    </span>
  );
}
