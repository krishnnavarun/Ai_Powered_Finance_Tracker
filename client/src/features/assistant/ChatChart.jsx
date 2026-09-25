import { useReducedMotion } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RankedBars } from '@/components/common/RankedBars';
import { formatMoney, formatMoneyCompact } from '@/lib/money';

// Charts from the assistant come in rupees; the app's money helpers use paise.
const paise = (rupees) => Math.round(rupees * 100);
const axis = { tickLine: false, tick: { fill: 'var(--muted-foreground)', fontSize: 11 } };

function ChartTooltip({ active, payload, label, names }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-semibold">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="tabular-nums">
          {names?.[item.dataKey] ? `${names[item.dataKey]}: ` : ''}
          {formatMoney(paise(item.value))}
        </p>
      ))}
    </div>
  );
}

// A table with the same numbers, for screen readers.
function DataTable({ chart }) {
  const compare = chart.type === 'compare';
  return (
    <table className="sr-only">
      <caption>{chart.title}</caption>
      <thead>
        <tr>
          <th scope="col">Item</th>
          {compare ? (
            <>
              <th scope="col">{chart.series.a}</th>
              <th scope="col">{chart.series.b}</th>
            </>
          ) : (
            <th scope="col">Amount</th>
          )}
        </tr>
      </thead>
      <tbody>
        {chart.data.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            {compare ? (
              <>
                <td>{formatMoney(paise(row.a))}</td>
                <td>{formatMoney(paise(row.b))}</td>
              </>
            ) : (
              <td>{formatMoney(paise(row.value))}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// The chart that came with an answer: ranked bars, a line over time, or two periods.
export function ChatChart({ chart }) {
  const reduceMotion = useReducedMotion();
  if (!chart?.data?.length) return null;

  return (
    <figure className="mt-3 rounded-xl border bg-background/60 p-3">
      <figcaption className="mb-3 text-xs font-medium text-muted-foreground">
        {chart.title}
      </figcaption>
      {chart.type === 'bar' && (
        <RankedBars
          label={chart.title}
          rows={chart.data.slice(0, 10).map((row) => ({
            key: row.label,
            label: row.label,
            amount: paise(row.value),
          }))}
        />
      )}
      {chart.type === 'line' && (
        <div className="h-44" aria-hidden="true">
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 360, height: 176 }}
          >
            <LineChart data={chart.data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                {...axis}
                axisLine={{ stroke: 'var(--border)' }}
                minTickGap={24}
              />
              <YAxis
                {...axis}
                axisLine={false}
                width={48}
                tickFormatter={(v) => formatMoneyCompact(paise(v))}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--chart-in)"
                strokeWidth={2}
                dot={chart.data.length <= 12 ? { r: 4 } : false}
                isAnimationActive={!reduceMotion}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {chart.type === 'compare' && (
        <>
          <ul
            className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground"
            aria-hidden="true"
          >
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-[var(--chart-in)]" />
              {chart.series.a}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-[var(--chart-out)]" />
              {chart.series.b}
            </li>
          </ul>
          <div className="h-52" aria-hidden="true">
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 360, height: 208 }}
            >
              <BarChart
                data={chart.data}
                barGap={2}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  {...axis}
                  axisLine={{ stroke: 'var(--border)' }}
                  interval={0}
                />
                <YAxis
                  {...axis}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v) => formatMoneyCompact(paise(v))}
                />
                <Tooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
                  content={<ChartTooltip names={chart.series} />}
                />
                <Bar
                  dataKey="a"
                  fill="var(--chart-in)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                  isAnimationActive={!reduceMotion}
                />
                <Bar
                  dataKey="b"
                  fill="var(--chart-out)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                  isAnimationActive={!reduceMotion}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
      {chart.type !== 'bar' && <DataTable chart={chart} />}
    </figure>
  );
}
