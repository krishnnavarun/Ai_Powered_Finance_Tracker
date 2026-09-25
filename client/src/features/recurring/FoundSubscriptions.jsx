import { CircleAlert, Repeat, RotateCcw } from 'lucide-react';
import { m } from 'motion/react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSubscriptionStatus, useSubscriptions } from '@/features/analytics/useAnalytics';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

const PERIOD = { weekly: 'week', monthly: 'month', yearly: 'year' };
const STATUS = { cancelled: 'Cancelled', ignored: 'Not a subscription' };
const day = (date) => formatDate(`${date}T00:00:00Z`, 'UTC');

// Subscriptions spotted in the user's payments (same shop, same amount, regular gaps).
export function FoundSubscriptions() {
  const { data } = useSubscriptions();
  const setStatus = useSubscriptionStatus();
  const list = data?.subscriptions ?? [];
  if (!list.length) return null;

  const change = (subscription, status, message) =>
    setStatus.mutate(
      { id: subscription.id, status },
      {
        onSuccess: () => toast.success(message),
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <section aria-label="Subscriptions found" className="mt-8 grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold">Found in your payments</h2>
          <p className="text-sm text-muted-foreground">
            Charges that repeat with nearly the same amount. Cancel the ones you don’t use.
          </p>
        </div>
        {data.totals.count > 0 && (
          <p className="surface px-3 py-2 text-sm">
            <span className="font-semibold">{formatMoney(data.totals.yearly)}</span> a year on{' '}
            {data.totals.count} subscription{data.totals.count === 1 ? '' : 's'}
          </p>
        )}
      </div>

      <ul className="grid gap-3 lg:grid-cols-2">
        {list.map((s, index) => {
          const active = s.status === 'active';
          return (
            <m.li
              key={s.id}
              aria-label={s.displayName}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.05, 0.3) }}
              className={cn('surface grid gap-3 p-4', !active && 'opacity-70')}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Repeat className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {s.displayName}
                    {!active && <Badge variant="secondary">{STATUS[s.status]}</Badge>}
                    {active && s.late && (
                      <Badge variant="outline" className="border-gold/60">
                        <CircleAlert aria-hidden="true" /> No charge lately
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(s.avgAmount)} every {PERIOD[s.period]} · {s.chargeCount} charges
                    {active && !s.late && ` · next around ${day(s.nextExpectedAt)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatMoney(s.yearlyCost)}</p>
                  <p className="text-xs text-muted-foreground">a year</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {active ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => change(s, 'cancelled', `Marked ${s.displayName} as cancelled`)}
                    >
                      I cancelled it
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => change(s, 'ignored', `${s.displayName} hidden from totals`)}
                    >
                      Not a subscription
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => change(s, 'active', `${s.displayName} counted again`)}
                  >
                    <RotateCcw aria-hidden="true" />
                    Undo
                  </Button>
                )}
              </div>
            </m.li>
          );
        })}
      </ul>
    </section>
  );
}
