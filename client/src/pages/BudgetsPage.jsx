import { ChevronLeft, ChevronRight, Copy, PiggyBank, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { listBudgets } from '@/api/planning';
import { AnimatedMoney } from '@/components/common/AnimatedMoney';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BudgetCard, BudgetStatus } from '@/features/budgets/BudgetCard';
import { BudgetFormDialog } from '@/features/budgets/BudgetFormDialog';
import { SuggestBudgetsDialog } from '@/features/budgets/SuggestBudgetsDialog';
import { useBudgetMutations, useBudgetStatus } from '@/features/budgets/useBudgets';
import { useCategories, useCategoryLookup } from '@/features/categories/useCategories';
import { formatMonth, shiftMonth } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

export function BudgetsPage() {
  // undefined = "this month" (the server knows the user's month start day).
  const [month, setMonth] = useState();
  const { data, isPending, isError, refetch, isPlaceholderData } = useBudgetStatus(month);
  const { data: categories = [] } = useCategories();
  const categoryLookup = useCategoryLookup();
  const { create, remove } = useBudgetMutations();
  const [editing, setEditing] = useState(null); // status item, 'new' or null
  const [deleting, setDeleting] = useState(null);
  const [copying, setCopying] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const shownMonth = data?.month;
  const items = data?.budgets ?? [];
  const overall = items.find((item) => item.budget.categoryId === null);
  const takenIds = new Set(items.map((item) => item.budget.categoryId));

  const copyLastMonth = async () => {
    setCopying(true);
    try {
      const { budgets } = await listBudgets(shiftMonth(shownMonth, -1));
      if (budgets.length === 0) {
        toast.info(
          `There were no budgets in ${formatMonth(shiftMonth(shownMonth, -1), { long: true })}`,
        );
        return;
      }
      for (const { categoryId, limit, alertLevels, rollover } of budgets) {
        await create.mutateAsync({ month: shownMonth, categoryId, limit, alertLevels, rollover });
      }
      toast.success(`Copied ${budgets.length} ${budgets.length === 1 ? 'budget' : 'budgets'}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCopying(false);
    }
  };

  const confirmDelete = () =>
    remove.mutate(deleting.budget.id, {
      onSuccess: () => toast.success('Budget deleted'),
      onError: (error) => toast.error(error.message),
      onSettled: () => setDeleting(null),
    });

  return (
    <>
      <PageHeader
        title="Budgets"
        description="How much you plan to spend"
        actions={
          <>
            <Button variant="outline" onClick={() => setSuggesting(true)} disabled={!shownMonth}>
              <Sparkles aria-hidden="true" />
              Suggest budgets
            </Button>
            <Button onClick={() => setEditing('new')} disabled={!shownMonth}>
              <Plus aria-hidden="true" />
              Add budget
            </Button>
          </>
        }
      />

      {shownMonth && (
        <nav
          aria-label="Month"
          className="surface mb-4 flex items-center justify-between gap-2 p-2"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => setMonth(shiftMonth(shownMonth, -1))}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <div className="text-center">
            <p className="font-semibold">{formatMonth(shownMonth, { long: true })}</p>
            <p className="text-xs text-muted-foreground">
              {data.daysLeft > 0 ? `${data.daysLeft} days left` : 'Month finished'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => setMonth(shiftMonth(shownMonth, 1))}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      )}

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-label="Loading budgets">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title="Couldn't load your budgets"
          description="Check your connection and try again."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title={`No budgets for ${formatMonth(shownMonth, { long: true })}`}
          description="Set a limit for a category, like Food or Shopping, and see how you're doing as you spend."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setEditing('new')}>
                <Plus aria-hidden="true" />
                Add budget
              </Button>
              <Button variant="outline" onClick={copyLastMonth} disabled={copying}>
                <Copy aria-hidden="true" />
                Copy last month’s budgets
              </Button>
            </div>
          }
        />
      ) : (
        <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
          <section aria-label="This month" className="surface mb-4 grid gap-3 p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Spent this month</p>
                <p className="text-3xl font-semibold tracking-tight">
                  <AnimatedMoney paise={data.totalSpent} />
                </p>
              </div>
              {overall && (
                <div className="text-right">
                  <BudgetStatus status={overall.status} />
                  <p className="text-sm text-muted-foreground">
                    of {formatMoney(overall.effectiveLimit)} overall
                  </p>
                </div>
              )}
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((item, index) => (
              <BudgetCard
                key={item.budget.id}
                item={item}
                index={index}
                category={categoryLookup.get(item.budget.categoryId)}
                daysLeft={data.daysLeft}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            ))}
          </div>
        </div>
      )}

      {shownMonth && (
        <BudgetFormDialog
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          month={shownMonth}
          budget={editing === 'new' ? null : editing?.budget}
          categories={categories}
          takenIds={takenIds}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this budget?"
        description="Your spending stays. Only the limit is removed."
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
      <SuggestBudgetsDialog
        open={suggesting}
        onOpenChange={setSuggesting}
        month={shownMonth}
        existing={items}
        categoryLookup={categoryLookup}
      />
    </>
  );
}
