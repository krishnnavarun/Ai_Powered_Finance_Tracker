import { FlaskConical, LoaderCircle } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useWhatIf } from '@/features/analytics/useAnalytics';
import { formatMonth } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

// Waits until the value stops changing (the slider is being dragged) before using it.
function useSettled(value, delay = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

function goalLine(goal) {
  if (goal.after.months === null) return 'Not reachable while spending is more than income';
  if (goal.after.months === 0) return 'Already reached';
  const when = `${formatMonth(goal.after.date.slice(0, 7), { long: true })}`;
  if (goal.monthsSooner > 0) {
    return `By ${when}, ${goal.monthsSooner} month${goal.monthsSooner === 1 ? '' : 's'} sooner`;
  }
  if (goal.monthsSooner < 0) {
    return `By ${when}, ${-goal.monthsSooner} month${goal.monthsSooner === -1 ? '' : 's'} later`;
  }
  return `By ${when}, no change`;
}

// "What if I spent 20% less on food?" — new monthly savings and goal dates.
export function WhatIfPanel({ categories }) {
  const sliderId = useId();
  const expense = categories.filter((c) => c.type === 'expense' && !c.isArchived && !c.parentId);
  // The user's pick, else Food & Dining (worked out each render: categories may still
  // be loading on the first one).
  const [picked, setCategoryId] = useState(null);
  const categoryId =
    picked ?? (expense.find((c) => c.name === 'Food & Dining') ?? expense[0])?.id ?? '';
  const [percent, setPercent] = useState(-20);
  const settledPercent = useSettled(percent);
  const changes =
    categoryId && settledPercent !== 0 ? [{ categoryId, changePercent: settledPercent }] : [];
  const { data, isFetching } = useWhatIf(changes);
  const category = expense.find((c) => c.id === categoryId);
  const row = data?.changes?.[0];

  if (!expense.length) return null;

  return (
    <section aria-label="What if" className="surface mt-6 grid gap-4 p-5">
      <div className="flex items-center gap-2">
        <FlaskConical className="size-4 text-gold" aria-hidden="true" />
        <h2 className="font-semibold">What if…</h2>
        {isFetching && (
          <LoaderCircle
            className="size-3.5 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${sliderId}-category`}>I change my spending on</Label>
          <NativeSelect
            id={`${sliderId}-category`}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {expense.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={sliderId}>
            By{' '}
            <span
              className={cn(
                'font-semibold',
                percent < 0 ? 'text-income' : percent > 0 && 'text-expense',
              )}
            >
              {percent > 0 ? '+' : ''}
              {percent}%
            </span>
          </Label>
          <input
            id={sliderId}
            type="range"
            min={-50}
            max={50}
            step={5}
            value={percent}
            aria-valuetext={`${percent > 0 ? 'spend' : 'cut'} ${Math.abs(percent)} percent`}
            onChange={(event) => setPercent(Number(event.target.value))}
            className="h-2 w-full cursor-pointer accent-[var(--primary)]"
          />
        </div>
      </div>

      {percent === 0 ? (
        <p className="text-sm text-muted-foreground">Move the slider to see what changes.</p>
      ) : data && row ? (
        <div className="grid gap-3" aria-live="polite">
          <p className="text-sm">
            {row.before === 0 ? (
              <>You haven’t spent on {category?.name} in the last 3 months, so nothing changes.</>
            ) : (
              <>
                Spending {formatMoney(row.after)} instead of {formatMoney(row.before)} a month on{' '}
                {category?.name} means you{' '}
                <strong className={data.savingsChange >= 0 ? 'text-income' : 'text-expense'}>
                  save {formatMoney(Math.abs(data.savingsChange))}{' '}
                  {data.savingsChange >= 0 ? 'more' : 'less'}
                </strong>{' '}
                a month ({formatMoney(Math.abs(data.yearlySavingsChange))} a year).
              </>
            )}
          </p>
          {data.goals.length > 0 && (
            <ul className="grid gap-2">
              {data.goals.map((goal) => (
                <li
                  key={goal.goalId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{goal.name}</span>
                  <span className={cn(goal.monthsSooner > 0 && 'font-medium text-income')}>
                    {goalLine(goal)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
