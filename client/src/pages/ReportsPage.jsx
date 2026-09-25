import { Download, FileText, Receipt, Sheet, Store, Tags, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { exportReport } from '@/api/planning';
import { AnimatedMoney } from '@/components/common/AnimatedMoney';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { RankedBars } from '@/components/common/RankedBars';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendChart } from '@/features/dashboard/TrendChart';
import { PERIODS, periodRange } from '@/features/reports/periods';
import {
  useMonthlyTrend,
  useReportSummary,
  useSpendingByCategory,
  useSpendingByWallet,
  useTopMerchants,
} from '@/features/reports/useReports';
import { formatDate, useTimeZone } from '@/lib/dates';
import { saveFile } from '@/lib/download';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

const TABS = [
  { id: 'categories', label: 'Categories', icon: Tags },
  { id: 'places', label: 'Places', icon: Store },
  { id: 'wallets', label: 'Wallets', icon: Wallet },
];

function Tile({ label, children }) {
  return (
    <div className="surface p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{children}</p>
    </div>
  );
}

export function ReportsPage() {
  const timeZone = useTimeZone();
  const startDay = useAuthStore((state) => state.user?.monthStartDay ?? 1);
  const [params, setParams] = useSearchParams();
  const period = params.get('period') ?? 'this-month';
  const [tab, setTab] = useState('categories');
  const [exporting, setExporting] = useState(null);

  const range =
    period === 'custom' && params.get('from') && params.get('to')
      ? { from: params.get('from'), to: params.get('to') }
      : periodRange(period === 'custom' ? 'this-month' : period, { timeZone, startDay });

  const summary = useReportSummary(range);
  const categories = useSpendingByCategory(range);
  const merchants = useTopMerchants(range);
  const wallets = useSpendingByWallet(range);
  const { data: trend = [] } = useMonthlyTrend(12);

  const setPeriod = (id) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('period', id);
      if (id === 'custom') {
        next.set('from', range.from);
        next.set('to', range.to);
      } else {
        next.delete('from');
        next.delete('to');
      }
      return next;
    });
  const setCustom = (key, value) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      return next;
    });

  const download = async (format) => {
    setExporting(format);
    try {
      const { blob, filename } = await exportReport({ format, ...range });
      saveFile(blob, filename);
      toast.success(`Downloaded ${filename}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setExporting(null);
    }
  };

  const data = summary.data;
  const rows = {
    categories: (categories.data?.categories ?? []).map((c) => ({
      key: c.categoryId ?? 'uncategorized',
      label: c.name,
      icon: c.icon,
      amount: c.total,
      note: `${c.percent}%`,
    })),
    places: (merchants.data?.merchants ?? []).map((m) => ({
      key: m.merchantKey,
      label: m.name,
      amount: m.total,
      note: `${m.count}×`,
    })),
    wallets: (wallets.data?.wallets ?? [])
      .filter((w) => w.expense > 0)
      .map((w) => ({ key: w.walletId, label: w.name, icon: w.icon, amount: w.expense })),
  };

  return (
    <>
      <PageHeader
        title="Reports"
        description="Your spending in charts"
        actions={
          <>
            <Button variant="outline" onClick={() => download('csv')} disabled={Boolean(exporting)}>
              <Sheet aria-hidden="true" />
              {exporting === 'csv' ? 'Preparing…' : 'Download CSV'}
            </Button>
            <Button variant="outline" onClick={() => download('pdf')} disabled={Boolean(exporting)}>
              <FileText aria-hidden="true" />
              {exporting === 'pdf' ? 'Preparing…' : 'Download PDF'}
            </Button>
          </>
        }
      />

      <section aria-label="Period" className="surface mb-4 grid gap-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Period">
          {PERIODS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={period === option.id}
              onClick={() => setPeriod(option.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 hover:-translate-y-px active:scale-95',
                period === option.id
                  ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="grid gap-1.5">
              <Label htmlFor="report-from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input
                id="report-from"
                type="date"
                value={range.from}
                max={range.to}
                onChange={(event) => setCustom('from', event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="report-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input
                id="report-to"
                type="date"
                value={range.to}
                min={range.from}
                onChange={(event) => setCustom('to', event.target.value)}
              />
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {formatDate(`${range.from}T00:00:00Z`, 'UTC')} –{' '}
          {formatDate(`${range.to}T00:00:00Z`, 'UTC')}
        </p>
      </section>

      {data && (
        <section aria-label="Summary" className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Money in">
            <AnimatedMoney paise={data.income} className="text-income" />
          </Tile>
          <Tile label="Money out">
            <AnimatedMoney paise={data.expense} className="text-expense" />
          </Tile>
          <Tile label="Saved">
            <AnimatedMoney paise={data.saved} />
            {data.savingsRate !== null && (
              <span className="ml-2 text-sm font-medium text-muted-foreground">
                {data.savingsRate}%
              </span>
            )}
          </Tile>
          <Tile label="Spent per day (average)">
            <AnimatedMoney paise={data.avgDailySpend} />
          </Tile>
        </section>
      )}

      {data?.biggestExpense && (
        <p className="surface mb-4 flex items-center gap-2 p-3 text-sm">
          <Receipt className="size-4 text-muted-foreground" aria-hidden="true" />
          Biggest payment: <strong>{formatMoney(data.biggestExpense.amount)}</strong>
          {data.biggestExpense.merchant && <> at {data.biggestExpense.merchant}</>} on{' '}
          {formatDate(data.biggestExpense.date, timeZone)}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <section
          aria-label="Breakdown"
          className="surface grid content-start gap-4 p-5 lg:col-span-2"
        >
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/80 p-1" role="tablist">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition-all duration-200',
                  tab === id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab).label}>
            {rows[tab].length === 0 ? (
              <EmptyState
                icon={Download}
                title="Nothing spent in this period"
                description="Pick another period, or add some payments."
                className="border-none bg-transparent py-8 shadow-none"
              />
            ) : (
              <RankedBars rows={rows[tab]} label={`Spending by ${tab}`} />
            )}
          </div>
        </section>
        <div className="lg:col-span-3">
          <TrendChart months={trend} title="Last 12 months" />
        </div>
      </div>
    </>
  );
}
