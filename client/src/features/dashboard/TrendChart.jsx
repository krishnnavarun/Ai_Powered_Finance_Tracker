import { useReducedMotion } from 'motion/react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMonth } from '@/lib/dates';
import { formatMoney, formatMoneyCompact } from '@/lib/money';

// Colours are validated for colour-blind safety in both themes (see --chart-in/out).
const SERIES = [
  { key: 'income', label: 'Money in', color: 'var(--chart-in)' },
  { key: 'expense', label: 'Money out', color: 'var(--chart-out)' },
];

function Legend() {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden="true">
      {SERIES.map((series) => (
        <li key={series.key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: series.color }} />
          {series.label}
        </li>
      ))}
    </ul>
  );
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const month = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-semibold">{formatMonth(month.month, { long: true })}</p>
      {SERIES.map((series) => (
        <p key={series.key} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: series.color }} />
            {series.label}
          </span>
          <span className="font-medium tabular-nums">{formatMoney(month[series.key])}</span>
        </p>
      ))}
      <p className="mt-1 flex justify-between gap-4 border-t pt-1">
        <span>Saved</span>
        <span className="font-medium tabular-nums">{formatMoney(month.saved)}</span>
      </p>
    </div>
  );
}

// Money in vs money out for each month — grouped bars on one ₹ axis.
export function TrendChart({ months, title = 'Money in and out' }) {
  const reduceMotion = useReducedMotion();
  const data = months.map((month) => ({ ...month, label: formatMonth(month.month) }));

  return (
    <figure className="surface flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="font-semibold">{title}</figcaption>
        <Legend />
      </div>

      <div className="h-56" aria-hidden="true">
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 480, height: 224 }}
        >
          <BarChart
            data={data}
            barGap={2}
            barCategoryGap="28%"
            margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <YAxis
              tickFormatter={formatMoneyCompact}
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={<TrendTooltip />} />
            {SERIES.map((series) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={series.label}
                fill={series.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
                isAnimationActive={!reduceMotion}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* The same numbers as a table, for screen readers. */}
      <table className="sr-only">
        <caption>Money in and out by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Money in</th>
            <th scope="col">Money out</th>
            <th scope="col">Saved</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.month}>
              <th scope="row">{formatMonth(month.month, { long: true })}</th>
              <td>{formatMoney(month.income)}</td>
              <td>{formatMoney(month.expense)}</td>
              <td>{formatMoney(month.saved)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
