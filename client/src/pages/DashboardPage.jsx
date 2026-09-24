import { ChartPie, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react';
import { m } from 'motion/react';
import { AnimatedMoney } from '@/components/common/AnimatedMoney';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { BalanceCard } from '@/features/dashboard/BalanceCard';
import { useTransactions } from '@/features/transactions/useTransactions';
import { useWallets } from '@/features/wallets/useWallets';
import { startOfMonth, toLocalDate, useTimeZone } from '@/lib/dates';
import { firstName } from '@/lib/user';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

// Cards slide in one after another.
const list = { show: { transition: { staggerChildren: 0.08 } } };
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

function StatCard({ label, icon: Icon, tone, children }) {
  return (
    <m.div
      variants={item}
      whileHover={{ y: -3 }}
      className="surface p-4 transition-shadow hover:shadow-lg"
    >
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        <span
          className={cn(
            'flex size-8 items-center justify-center rounded-lg',
            tone === 'income' && 'bg-income/12 text-income',
            tone === 'expense' && 'bg-expense/12 text-expense',
            tone === 'gold' && 'bg-gold/20 text-gold-foreground dark:text-gold',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold">{children}</p>
    </m.div>
  );
}

export function DashboardPage() {
  const name = useAuthStore((state) => firstName(state.user?.name));
  const timeZone = useTimeZone();
  const today = toLocalDate(new Date(), timeZone);
  const { data: wallets = [] } = useWallets();
  // Only the totals are needed, so ask for the smallest page.
  const { data: month } = useTransactions({ from: startOfMonth(today), to: today, limit: 1 });

  const balance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  const income = month?.totals.income ?? 0;
  const spent = month?.totals.expense ?? 0;
  const saved = income - spent;
  const savingsRate = income > 0 ? Math.round((saved / income) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={name ? `Hi ${name}, here's your money today` : 'Your money today'}
      />

      <m.section
        aria-label="Summary"
        className="grid gap-4 lg:grid-cols-3"
        variants={list}
        initial="hidden"
        animate="show"
      >
        <m.div variants={item} className="lg:row-span-2">
          <BalanceCard balance={balance} walletCount={wallets.length} />
        </m.div>
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-2">
          <StatCard label="Money in this month" icon={TrendingUp} tone="income">
            <AnimatedMoney paise={income} className="text-income" />
          </StatCard>
          <StatCard label="Money out this month" icon={TrendingDown} tone="expense">
            <AnimatedMoney paise={spent} className="text-expense" />
          </StatCard>
          <StatCard label="Saved this month" icon={PiggyBank} tone="gold">
            <AnimatedMoney paise={Math.max(saved, 0)} />
            <span className="ml-2 text-sm font-medium text-muted-foreground">{savingsRate}%</span>
          </StatCard>
        </div>
      </m.section>

      <EmptyState
        className="mt-6"
        icon={ChartPie}
        title="More is coming"
        description="Charts, budgets and money tips will show up here soon."
      />
    </>
  );
}
