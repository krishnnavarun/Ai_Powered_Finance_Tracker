import { ArrowRight, Lightbulb, PiggyBank, ReceiptText, Target } from 'lucide-react';
import { Link } from 'react-router';
import { Money } from '@/components/common/Money';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Button } from '@/components/ui/button';
import { BudgetStatus } from '@/features/budgets/BudgetCard';
import { ProgressRing } from '@/features/goals/ProgressRing';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

function Panel({ title, to, linkLabel, children }) {
  return (
    <section aria-label={title} className="surface flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <Link
          to={to}
          className="group inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {linkLabel}
          <ArrowRight
            className="size-3 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Empty({ icon: Icon, text, to, action }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center text-sm text-muted-foreground">
      <Icon className="size-6" aria-hidden="true" />
      {text}
      <Button asChild size="sm" variant="outline">
        <Link to={to}>{action}</Link>
      </Button>
    </div>
  );
}

// The budgets that most need attention: over first, then nearly used up.
const URGENCY = { over: 0, warning: 1, ok: 2 };

export function BudgetsOverview({ status, categoryLookup }) {
  const items = [...(status?.budgets ?? [])]
    .sort((a, b) => URGENCY[a.status] - URGENCY[b.status] || b.percent - a.percent)
    .slice(0, 3);

  return (
    <Panel title="Budgets" to="/budgets" linkLabel="All budgets">
      {items.length === 0 ? (
        <Empty
          icon={PiggyBank}
          text="Set a monthly limit to stay on track."
          to="/budgets"
          action="Set a budget"
        />
      ) : (
        <ul className="grid gap-4">
          {items.map((item) => {
            const name = categoryLookup.get(item.budget.categoryId)?.name ?? 'Overall';
            return (
              <li key={item.budget.id} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{name}</span>
                  <BudgetStatus status={item.status} />
                </div>
                <ProgressBar
                  percent={item.percent}
                  tone={item.status}
                  label={`${name}: ${item.percent}% used`}
                />
                <p className="text-xs text-muted-foreground">
                  {formatMoney(item.spent)} of {formatMoney(item.effectiveLimit)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function GoalsOverview({ goals }) {
  const active = (goals ?? []).filter((goal) => goal.status === 'active').slice(0, 2);
  return (
    <Panel title="Goals" to="/goals" linkLabel="All goals">
      {active.length === 0 ? (
        <Empty
          icon={Target}
          text="Save up for something you want."
          to="/goals"
          action="Add a goal"
        />
      ) : (
        <ul className="grid gap-4">
          {active.map((goal) => (
            <li key={goal.id} className="flex items-center gap-3">
              <ProgressRing percent={goal.progress.percent} size={52} />
              <div className="min-w-0">
                <p className="truncate font-medium">{goal.name}</p>
                <p className="text-xs text-muted-foreground">
                  {goal.progress.requiredPerMonth
                    ? `Save ${formatMoney(goal.progress.requiredPerMonth)} a month`
                    : `${formatMoney(goal.progress.remaining)} to go`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function RecentTransactions({ transactions, categoryLookup, walletLookup, timeZone }) {
  return (
    <Panel title="Recent" to="/transactions" linkLabel="See all">
      {transactions.length === 0 ? (
        <Empty
          icon={ReceiptText}
          text="Your latest payments show up here."
          to="/transactions"
          action="Add a payment"
        />
      ) : (
        <ul className="grid gap-3">
          {transactions.map((txn) => {
            const category = categoryLookup.get(txn.categoryId);
            const title =
              txn.type === 'transfer'
                ? 'Transfer'
                : txn.merchant || category?.name || (txn.type === 'income' ? 'Income' : 'Expense');
            return (
              <li key={txn.id} className="flex items-center gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {walletLookup.get(txn.walletId)?.name ?? ''} · {formatDate(txn.date, timeZone)}
                  </p>
                </div>
                <Money
                  paise={txn.amount}
                  tone={txn.type === 'transfer' ? undefined : txn.type}
                  className="font-medium whitespace-nowrap"
                />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function InsightsOverview({ insights }) {
  const latest = (insights ?? []).slice(0, 3);
  return (
    <Panel title="Tips for you" to="/insights" linkLabel="All tips">
      {latest.length === 0 ? (
        <Empty
          icon={Lightbulb}
          text="Tips about unusual spending and money running low show up here."
          to="/insights"
          action="See insights"
        />
      ) : (
        <ul className="grid gap-3">
          {latest.map((insight) => (
            <li key={insight.id} className="flex gap-2.5 text-sm">
              <span
                className={cn(
                  'mt-1.5 size-2 shrink-0 rounded-full',
                  insight.severity === 'critical'
                    ? 'bg-destructive'
                    : insight.severity === 'warn'
                      ? 'bg-gold'
                      : 'bg-primary',
                )}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="font-medium">{insight.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{insight.message}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
