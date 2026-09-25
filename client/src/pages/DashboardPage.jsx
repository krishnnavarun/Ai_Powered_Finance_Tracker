import { PiggyBank, TrendingDown, TrendingUp } from 'lucide-react';
import { m } from 'motion/react';
import { AnimatedMoney } from '@/components/common/AnimatedMoney';
import { PageHeader } from '@/components/common/PageHeader';
import { useBudgetStatus } from '@/features/budgets/useBudgets';
import { QuickAddBar } from '@/features/capture/QuickAddBar';
import { useCategoryLookup } from '@/features/categories/useCategories';
import { BalanceCard } from '@/features/dashboard/BalanceCard';
import { useForecast, useHealthScore } from '@/features/analytics/useAnalytics';
import { ForecastCard } from '@/features/dashboard/ForecastCard';
import { HealthCard } from '@/features/dashboard/HealthCard';
import {
  BudgetsOverview,
  GoalsOverview,
  InsightsOverview,
  RecentTransactions,
} from '@/features/dashboard/Overviews';
import { SpendingByCategory } from '@/features/dashboard/SpendingByCategory';
import { TrendChart } from '@/features/dashboard/TrendChart';
import { useGoals } from '@/features/goals/useGoals';
import { useInsights } from '@/features/insights/useInsights';
import { useMonthlyTrend, useSpendingByCategory } from '@/features/reports/useReports';
import { useTransactions } from '@/features/transactions/useTransactions';
import { useWalletLookup, useWallets } from '@/features/wallets/useWallets';
import { useTimeZone } from '@/lib/dates';
import { firstName } from '@/lib/user';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

// Sections slide in one after another.
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
  const { data: wallets = [] } = useWallets();
  const { data: trend = [] } = useMonthlyTrend(6);
  const { data: byCategory } = useSpendingByCategory();
  const { data: budgetStatus } = useBudgetStatus();
  const { data: goals } = useGoals();
  const { data: recent } = useTransactions({ limit: 5 });
  const { data: forecast } = useForecast();
  const { data: health } = useHealthScore();
  const { data: insightData } = useInsights();
  const walletLookup = useWalletLookup();
  const categoryLookup = useCategoryLookup();

  const balance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  // This budget month is the last entry of the trend.
  const { income = 0, expense = 0 } = trend.at(-1) ?? {};
  const saved = income - expense;
  const savingsRate = income > 0 ? Math.round((saved / income) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={name ? `Hi ${name}, here's your money today` : 'Your money today'}
      />

      <m.div variants={list} initial="hidden" animate="show" className="grid gap-4">
        <m.div variants={item} className="grid gap-2">
          <QuickAddBar />
        </m.div>
        <section aria-label="Summary" className="grid gap-4 lg:grid-cols-3">
          <m.div variants={item} className="lg:row-span-2">
            <BalanceCard balance={balance} walletCount={wallets.length} />
          </m.div>
          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-2">
            <StatCard label="Money in this month" icon={TrendingUp} tone="income">
              <AnimatedMoney paise={income} className="text-income" />
            </StatCard>
            <StatCard label="Money out this month" icon={TrendingDown} tone="expense">
              <AnimatedMoney paise={expense} className="text-expense" />
            </StatCard>
            <StatCard label="Saved this month" icon={PiggyBank} tone="gold">
              <AnimatedMoney paise={Math.max(saved, 0)} />
              <span className="ml-2 text-sm font-medium text-muted-foreground">{savingsRate}%</span>
            </StatCard>
          </div>
        </section>

        <m.div variants={item} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ForecastCard forecast={forecast} />
          <HealthCard health={health} />
          <InsightsOverview insights={insightData?.insights} />
        </m.div>

        <m.div variants={item} className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TrendChart months={trend} />
          </div>
          {byCategory && <SpendingByCategory data={byCategory} />}
        </m.div>

        <m.div variants={item} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <BudgetsOverview status={budgetStatus} categoryLookup={categoryLookup} />
          <GoalsOverview goals={goals} />
          <RecentTransactions
            transactions={recent?.transactions ?? []}
            categoryLookup={categoryLookup}
            walletLookup={walletLookup}
            timeZone={timeZone}
          />
        </m.div>
      </m.div>
    </>
  );
}
