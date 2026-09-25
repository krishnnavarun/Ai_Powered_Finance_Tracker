import { CircleAlert, TrendingUp, TriangleAlert } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AnimatedMoney } from '@/components/common/AnimatedMoney';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatMoneyCompact } from '@/lib/money';
import { cn } from '@/lib/utils';

const WARNINGS = {
  negative: {
    icon: CircleAlert,
    text: 'You may run out of money before month end',
    className: 'bg-destructive/10 text-destructive',
  },
  low: {
    icon: TriangleAlert,
    text: 'Money may run low by month end',
    className: 'bg-gold/20 text-gold-foreground dark:text-gold',
  },
};

const day = (date) => formatDate(`${date}T00:00:00Z`, 'UTC');

function ForecastTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const value = point.actual ?? point.predicted;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-semibold">{day(point.date)}</p>
      <p>
        {point.actual !== undefined ? 'Balance' : 'Expected'}:{' '}
        <span className="font-medium tabular-nums">{formatMoney(value)}</span>
      </p>
    </div>
  );
}

// Month-end balance prediction with a small chart: solid line so far, dashed ahead.
export function ForecastCard({ forecast }) {
  const reduceMotion = useReducedMotion();
  if (!forecast) return null;
  const warning = WARNINGS[forecast.warning];

  return (
    <figure className="surface flex flex-col gap-3 p-5" aria-label="Month-end forecast">
      <div className="flex items-start justify-between gap-3">
        <div>
          <figcaption className="text-sm text-muted-foreground">
            Expected balance on {day(forecast.toDate)}
          </figcaption>
          <p className="mt-1 text-2xl font-semibold">
            <AnimatedMoney
              paise={forecast.predictedEnd}
              className={cn(forecast.predictedEnd < 0 && 'text-destructive')}
            />
          </p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <TrendingUp className="size-4" aria-hidden="true" />
        </span>
      </div>

      {warning && (
        <p
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
            warning.className,
          )}
        >
          <warning.icon className="size-4 shrink-0" aria-hidden="true" />
          {warning.text}
        </p>
      )}

      <div className="h-28" aria-hidden="true">
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 320, height: 112 }}
        >
          <AreaChart data={forecast.series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="forecast-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-in)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--chart-in)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={['auto', 'auto']} tickFormatter={formatMoneyCompact} />
            <Tooltip content={<ForecastTooltip />} cursor={{ stroke: 'var(--border)' }} />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="var(--chart-in)"
              strokeWidth={2}
              fill="url(#forecast-fill)"
              isAnimationActive={!reduceMotion}
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="predicted"
              stroke="var(--chart-in)"
              strokeWidth={2}
              strokeDasharray="5 4"
              fill="none"
              isAnimationActive={!reduceMotion}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden="true">
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-[var(--chart-in)]" /> So far
        </li>
        <li className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-[var(--chart-in)]" /> Expected
        </li>
      </ul>
      <p className="text-xs text-muted-foreground">
        Based on spending about {formatMoney(forecast.averageDaily)} a day
        {forecast.upcomingExpense > 0 &&
          `, plus ${formatMoney(forecast.upcomingExpense)} of recurring payments`}
        {forecast.upcomingIncome > 0 && ` and ${formatMoney(forecast.upcomingIncome)} coming in`}.
      </p>
    </figure>
  );
}
