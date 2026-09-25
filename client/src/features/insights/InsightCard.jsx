import {
  ChevronDown,
  CircleAlert,
  Copy,
  Info,
  PiggyBank,
  Repeat,
  TrendingUp,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

// Severity: an icon and a word, never colour alone.
const SEVERITY = {
  info: { label: 'Tip', icon: Info, className: 'text-primary bg-primary/10' },
  warn: {
    label: 'Heads up',
    icon: TriangleAlert,
    className: 'text-gold-foreground bg-gold/20 dark:text-gold',
  },
  critical: {
    label: 'Important',
    icon: CircleAlert,
    className: 'text-destructive bg-destructive/10',
  },
};

const TYPE_ICONS = {
  anomaly: Zap,
  forecast: TrendingUp,
  budget: PiggyBank,
  subscription: Repeat,
  duplicate: Copy,
  tip: Info,
  goal: PiggyBank,
};

// One insight: what happened, and a "Why?" that shows the numbers behind it.
export function InsightCard({ insight, timeZone, onDismiss, index = 0, compact = false }) {
  const [open, setOpen] = useState(false);
  const reasonId = useId();
  const severity = SEVERITY[insight.severity] ?? SEVERITY.info;
  const SeverityIcon = severity.icon;
  const TypeIcon = TYPE_ICONS[insight.type] ?? Info;

  return (
    <m.article
      aria-label={insight.title}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'surface relative flex gap-3 p-4 transition-shadow hover:shadow-lg',
        !insight.seen && 'ring-1 ring-primary/30',
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-xl',
          severity.className,
        )}
      >
        <TypeIcon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
              severity.className,
            )}
          >
            <SeverityIcon className="size-3" aria-hidden="true" />
            {severity.label}
          </span>
          {!insight.seen && <span className="font-medium text-primary">New</span>}
          {!compact && (
            <span className="text-muted-foreground">{formatDate(insight.createdAt, timeZone)}</span>
          )}
        </div>
        <h3 className="mt-1 font-medium">{insight.title}</h3>
        <p className="text-sm text-muted-foreground">{insight.message}</p>

        {insight.reason && (
          <>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={reasonId}
              onClick={() => setOpen((value) => !value)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Why?
              <ChevronDown
                className={cn('size-3 transition-transform duration-200', open && 'rotate-180')}
                aria-hidden="true"
              />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <m.p
                  id={reasonId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden text-xs"
                >
                  <span className="mt-2 block rounded-lg bg-muted/70 p-2.5 leading-relaxed">
                    {insight.reason}
                  </span>
                </m.p>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Dismiss "${insight.title}"`}
          onClick={() => onDismiss(insight)}
          className="-mt-1 -mr-1 shrink-0"
        >
          <X aria-hidden="true" />
        </Button>
      )}
    </m.article>
  );
}
