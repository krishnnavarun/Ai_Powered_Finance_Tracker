import { Plus, Repeat } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { AnimatedMoney } from '@/components/common/AnimatedMoney';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategoryLookup } from '@/features/categories/useCategories';
import { RecurringCard } from '@/features/recurring/RecurringCard';
import { FoundSubscriptions } from '@/features/recurring/FoundSubscriptions';
import { RecurringFormDialog } from '@/features/recurring/RecurringFormDialog';
import { monthlyTotals, ruleName } from '@/features/recurring/schedule';
import { useRecurring, useRecurringMutations } from '@/features/recurring/useRecurring';
import { useWalletLookup, useWallets } from '@/features/wallets/useWallets';

export function RecurringPage() {
  const { data: rules = [], isPending, isError, refetch } = useRecurring();
  const { data: activeWallets = [] } = useWallets();
  const wallets = useWalletLookup();
  const categories = useCategoryLookup();
  const { update, remove } = useRecurringMutations();

  const [editing, setEditing] = useState(null); // rule, 'new' or null
  const [deleting, setDeleting] = useState(null);

  const totals = monthlyTotals(rules);
  const running = rules.filter((rule) => rule.active && rule.nextDate);
  const stopped = rules.filter((rule) => !rule.active || !rule.nextDate);
  const nameOf = (rule) =>
    ruleName(rule, {
      category: categories.get(rule.template.categoryId),
      toWallet: wallets.get(rule.template.toWalletId),
    });

  const toggle = (rule) =>
    update.mutate(
      { id: rule.id, changes: { active: !rule.active } },
      {
        onSuccess: (saved) => toast.success(saved.active ? 'Resumed' : 'Paused'),
        onError: (error) => toast.error(error.message),
      },
    );

  const confirmDelete = () =>
    remove.mutate(deleting.id, {
      onSuccess: () => toast.success('Recurring payment deleted'),
      onError: (error) => toast.error(error.message),
      onSettled: () => setDeleting(null),
    });

  const addButton = (
    <Button onClick={() => setEditing('new')} disabled={activeWallets.length === 0}>
      <Plus aria-hidden="true" />
      Add recurring payment
    </Button>
  );

  const cards = (list, offset = 0) => (
    <div className="grid gap-4 lg:grid-cols-2">
      {list.map((rule, index) => (
        <RecurringCard
          key={rule.id}
          rule={rule}
          index={index + offset}
          category={categories.get(rule.template.categoryId)}
          wallet={wallets.get(rule.template.walletId)}
          toWallet={wallets.get(rule.template.toWalletId)}
          onEdit={setEditing}
          onToggle={toggle}
          onDelete={setDeleting}
        />
      ))}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Recurring"
        description="Payments that repeat, like rent, salary and subscriptions"
        actions={addButton}
      />

      {isPending ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-label="Loading recurring payments">
          {[1, 2].map((n) => (
            <Skeleton key={n} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title="Couldn't load your recurring payments"
          description="Check your connection and try again."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : rules.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Nothing repeats yet"
          description={
            activeWallets.length === 0
              ? 'Add a wallet first, then set up rent, salary or subscriptions here.'
              : 'Add rent, salary, a SIP or a subscription once, and Paisa Pal records it on each date.'
          }
          action={
            activeWallets.length === 0 ? (
              <Button asChild>
                <Link to="/wallets">Add a wallet</Link>
              </Button>
            ) : (
              addButton
            )
          }
        />
      ) : (
        <>
          <section aria-label="Every month" className="mb-4 grid gap-4 sm:grid-cols-2">
            <div className="surface p-4">
              <p className="text-sm text-muted-foreground">Money in each month</p>
              <p className="mt-1 text-2xl font-semibold">
                <AnimatedMoney paise={totals.income} className="text-income" />
              </p>
            </div>
            <div className="surface p-4">
              <p className="text-sm text-muted-foreground">Money out each month</p>
              <p className="mt-1 text-2xl font-semibold">
                <AnimatedMoney paise={totals.expense} className="text-expense" />
              </p>
            </div>
          </section>

          {running.length > 0 && cards(running)}
          {stopped.length > 0 && (
            <section aria-label="Paused or finished" className="mt-8">
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Paused or finished</h2>
              {cards(stopped, running.length)}
            </section>
          )}
        </>
      )}

      <FoundSubscriptions />

      <RecurringFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        rule={editing === 'new' ? null : editing}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete "${nameOf(deleting)}"?` : ''}
        description="It stops repeating. Payments it already added stay in your transactions."
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
