import { m } from 'motion/react';
import { Money } from '@/components/common/Money';
import { NamedIcon } from '@/components/common/NamedIcon';

// A ranked list of bars — easier to compare than a pie. Every bar has the same colour
// (they are the same kind of thing); names and amounts are written out, so nothing
// depends on colour. rows: [{ key, label, icon?, amount, note? }]
export function RankedBars({ rows, label, barClassName = 'bg-chart-out' }) {
  const largest = Math.max(1, ...rows.map((row) => row.amount));
  return (
    <ul className="grid gap-3" aria-label={label}>
      {rows.map((row, index) => (
        <li key={row.key} className="grid gap-1.5">
          <div className="flex items-center gap-2 text-sm">
            {row.icon && <NamedIcon name={row.icon} className="text-muted-foreground" />}
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            <Money paise={row.amount} className="font-medium" />
            {row.note && (
              <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">
                {row.note}
              </span>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <m.div
              className={`h-full rounded-full ${barClassName}`}
              initial={{ width: 0 }}
              animate={{ width: `${(row.amount / largest) * 100}%` }}
              transition={{
                duration: 0.7,
                delay: Math.min(index * 0.05, 0.4),
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
