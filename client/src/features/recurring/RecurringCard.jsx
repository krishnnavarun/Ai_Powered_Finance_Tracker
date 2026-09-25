import {
  ArrowLeftRight,
  CalendarClock,
  EllipsisVertical,
  Pause,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react';
import { m } from 'motion/react';
import { Money } from '@/components/common/Money';
import { IconBadge } from '@/components/common/NamedIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { describeSchedule, ruleName } from './schedule';

const TONE = { income: 'income', expense: 'expense', transfer: undefined };

// "2026-10-01" → "1 Oct 2026" (a calendar day, so no time-zone shift).
const day = (localDate) => formatDate(`${localDate}T00:00:00Z`, 'UTC');

export function RecurringCard({
  rule,
  category,
  wallet,
  toWallet,
  index = 0,
  onEdit,
  onToggle,
  onDelete,
}) {
  const t = rule.template;
  const name = ruleName(rule, { category, toWallet });
  const finished = !rule.nextDate;
  const status = !rule.active ? 'Paused' : finished ? 'Finished' : null;
  const signed = t.type === 'expense' ? -t.amount : t.amount;

  return (
    <m.article
      aria-label={name}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'surface flex flex-col gap-3 p-4 transition-shadow hover:shadow-lg',
        status && 'opacity-75',
      )}
    >
      <div className="flex items-start gap-3">
        {t.type === 'transfer' ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold-foreground dark:text-gold">
            <ArrowLeftRight className="size-4" aria-hidden="true" />
          </span>
        ) : (
          <IconBadge icon={category?.icon ?? 'repeat'} color={category?.color ?? '#475569'} />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 truncate font-medium">
            {name}
            {status && <Badge variant="secondary">{status}</Badge>}
          </h2>
          <p className="text-xs text-muted-foreground">
            {describeSchedule(rule)}
            {wallet && ` · ${wallet.name}`}
            {toWallet && ` → ${toWallet.name}`}
          </p>
        </div>
        <Money paise={signed} tone={TONE[t.type]} className="font-semibold tabular-nums" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
              <EllipsisVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(rule)}>
              <Pencil aria-hidden="true" />
              Edit
            </DropdownMenuItem>
            {!finished || !rule.active ? (
              <DropdownMenuItem onSelect={() => onToggle(rule)}>
                {rule.active ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                {rule.active ? 'Pause' : 'Resume'}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(rule)}>
              <Trash2 aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {rule.active && rule.upcoming?.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Next:</span>
          {rule.upcoming.map((date, i) => (
            <span
              key={date}
              className={cn(
                'rounded-full border px-2 py-0.5',
                i === 0
                  ? 'border-primary/40 bg-primary/8 font-medium text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {day(date)}
            </span>
          ))}
        </div>
      )}
      {rule.endDate && !finished && (
        <p className="text-xs text-muted-foreground">Ends on {day(rule.endDate)}</p>
      )}
    </m.article>
  );
}
