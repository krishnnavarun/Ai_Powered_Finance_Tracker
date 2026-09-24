import { LayoutDashboard, Percent, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Money } from '@/components/common/Money';
import { PageHeader } from '@/components/common/PageHeader';

// Placeholder numbers until transactions exist (CP8); the real dashboard arrives in CP11.
const STATS = [
  { label: 'Total balance', icon: Wallet, value: <Money paise={0} /> },
  { label: 'Income this month', icon: TrendingUp, value: <Money paise={0} tone="income" /> },
  { label: 'Spent this month', icon: TrendingDown, value: <Money paise={0} tone="expense" /> },
  { label: 'Savings rate', icon: Percent, value: <span className="tabular-nums">0%</span> },
];

export function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Your money at a glance" />

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map(({ label, icon: Icon, value }) => (
          <div key={label} className="rounded-xl border bg-card p-4 text-card-foreground shadow-xs">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              {label}
              <Icon className="size-4" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <EmptyState
        className="mt-6"
        icon={LayoutDashboard}
        title="Your dashboard is getting ready"
        description="Once you sign in and add transactions, you'll see charts, budgets, forecasts and your health score here."
      />
    </>
  );
}
