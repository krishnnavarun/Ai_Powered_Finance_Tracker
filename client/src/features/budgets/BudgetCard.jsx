import {
  CircleAlert,
  CircleCheck,
  EllipsisVertical,
  Pencil,
  PiggyBank,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { m } from 'motion/react';
import { Money } from '@/components/common/Money';
import { IconBadge } from '@/components/common/NamedIcon';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

// Status label + icon (so it never relies on colour alone).
const STATUS = {
  ok: { icon: CircleCheck, label: 'On track', className: 'text-primary' },
  warning: {
    icon: TriangleAlert,
    label: 'Almost at limit',
    className: 'text-gold-foreground dark:text-gold',
  },
  over: { icon: CircleAlert, label: 'Over budget', className: 'text-destructive' },
};

export function BudgetStatus({ status }) {
  const { icon: Icon, label, className } = STATUS[status];
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

// One budget: what it's for, how much is used, and what's left per day.
// `item` is one entry of GET /budgets/status → budgets[].
export function BudgetCard({ item, category, daysLeft, index = 0, onEdit, onDelete }) {
  const { spent, effectiveLimit, remaining, percent, status, dailyAllowance, rolloverAmount } =
    item;
  const name = category?.name ?? 'Overall budget';

  return (
    <m.article
      aria-label={name}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className="surface flex flex-col gap-3 p-4 transition-shadow hover:shadow-lg"
    >
      <div className="flex items-start gap-3">
        {category ? (
          <IconBadge icon={category.icon} color={category.color} />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold-foreground dark:text-gold">
            <PiggyBank className="size-4" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-medium">{name}</h2>
          <BudgetStatus status={status} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
              <EllipsisVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(item)}>
              <Pencil aria-hidden="true" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(item)}>
              <Trash2 aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
          <span>
            <Money paise={spent} className="font-semibold" />
            <span className="text-muted-foreground"> of </span>
            <Money paise={effectiveLimit} className="text-muted-foreground" />
          </span>
          <span className="text-xs text-muted-foreground">{percent}%</span>
        </div>
        <ProgressBar percent={percent} tone={status} label={`${name}: ${percent}% used`} />
      </div>

      <p className="text-xs text-muted-foreground">
        {remaining < 0 ? (
          <span className="font-medium text-destructive">Over by {formatMoney(-remaining)}</span>
        ) : daysLeft > 0 ? (
          <>
            {formatMoney(remaining)} left · about {formatMoney(dailyAllowance)} a day for {daysLeft}{' '}
            {daysLeft === 1 ? 'day' : 'days'}
          </>
        ) : (
          <>{formatMoney(remaining)} was left</>
        )}
        {rolloverAmount > 0 && <> · includes {formatMoney(rolloverAmount)} from last month</>}
      </p>
    </m.article>
  );
}
