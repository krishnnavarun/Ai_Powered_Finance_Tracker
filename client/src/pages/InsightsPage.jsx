import { Lightbulb, LoaderCircle, RefreshCw } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InsightCard } from '@/features/insights/InsightCard';
import { useInsightMutations, useInsights } from '@/features/insights/useInsights';
import { useTimeZone } from '@/lib/dates';

export function InsightsPage() {
  const timeZone = useTimeZone();
  const { data, isPending, isError, refetch } = useInsights();
  const { refresh, dismiss, markSeen } = useInsightMutations();
  const insights = data?.insights ?? [];

  // Opening the page counts as seeing them (the "New" marks stay until the next visit).
  const unseenIds = insights
    .filter((i) => !i.seen)
    .map((i) => i.id)
    .join(',');
  const { mutate: mark } = markSeen;
  useEffect(() => {
    if (!unseenIds) return undefined;
    const timer = setTimeout(() => mark(unseenIds.split(',')), 1500);
    return () => clearTimeout(timer);
  }, [unseenIds, mark]);

  const checkNow = () =>
    refresh.mutate(undefined, {
      onSuccess: ({ created }) =>
        toast.success(
          created ? `${created} new tip${created === 1 ? '' : 's'}` : 'Nothing new right now',
        ),
      onError: (error) => toast.error(error.message),
    });

  return (
    <>
      <PageHeader
        title="Insights"
        description="Tips and warnings about your money, with the reason for each"
        actions={
          <Button variant="outline" onClick={checkNow} disabled={refresh.isPending}>
            {refresh.isPending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            Check now
          </Button>
        }
      />

      {isPending ? (
        <div className="grid gap-3" aria-label="Loading insights">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title="Couldn't load your insights"
          description="Check your connection and try again."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : insights.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No tips yet"
          description="Paisa Pal looks at your payments every night and tells you about unusual spending, double charges, subscriptions and money running low."
          action={
            <Button onClick={checkNow} disabled={refresh.isPending}>
              Check now
            </Button>
          }
        />
      ) : (
        <section aria-label="All insights" className="grid gap-3">
          <AnimatePresence initial={false}>
            {insights.map((insight, index) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                index={index}
                timeZone={timeZone}
                onDismiss={(item) => dismiss.mutate(item.id)}
              />
            ))}
          </AnimatePresence>
        </section>
      )}
    </>
  );
}
