import { Plus, Target } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { AnimatedMoney } from '@/components/common/AnimatedMoney';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Celebration } from '@/features/goals/Celebration';
import { ContributeDialog } from '@/features/goals/ContributeDialog';
import { GoalCard } from '@/features/goals/GoalCard';
import { GoalFormDialog } from '@/features/goals/GoalFormDialog';
import { WhatIfPanel } from '@/features/goals/WhatIfPanel';
import { useCategories } from '@/features/categories/useCategories';
import { useGoalMutations, useGoals } from '@/features/goals/useGoals';
import { useWallets } from '@/features/wallets/useWallets';
import { formatMoney } from '@/lib/money';

export function GoalsPage() {
  const { data: goals = [], isPending, isError, refetch } = useGoals();
  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = useCategories();
  const { update, remove } = useGoalMutations();

  const [editing, setEditing] = useState(null); // goal, 'new' or null
  const [contributing, setContributing] = useState(null); // { goal, mode }
  const [deleting, setDeleting] = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const stopCelebrating = useCallback(() => setCelebrating(false), []);

  const saved = goals.reduce((sum, goal) => sum + goal.savedAmount, 0);
  const target = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);

  const afterContribution = (updated, paise) => {
    setContributing(null);
    if (updated.justCompleted) {
      setCelebrating(true);
      toast.success(`🎉 You reached "${updated.name}"!`);
    } else {
      toast.success(
        contributing?.mode === 'withdraw'
          ? `Took ${formatMoney(paise)} out of "${updated.name}"`
          : `Added ${formatMoney(paise)} to "${updated.name}"`,
      );
    }
  };

  const togglePause = (goal) =>
    update.mutate(
      { id: goal.id, changes: { status: goal.status === 'paused' ? 'active' : 'paused' } },
      {
        onSuccess: (saved) =>
          toast.success(saved.status === 'paused' ? 'Goal paused' : 'Goal resumed'),
        onError: (error) => toast.error(error.message),
      },
    );

  const confirmDelete = () =>
    remove.mutate(deleting.id, {
      onSuccess: () => toast.success('Goal deleted'),
      onError: (error) => toast.error(error.message),
      onSettled: () => setDeleting(null),
    });

  return (
    <>
      <PageHeader
        title="Goals"
        description="Things you are saving for"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            Add goal
          </Button>
        }
      />

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-label="Loading goals">
          {[1, 2].map((n) => (
            <Skeleton key={n} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title="Couldn't load your goals"
          description="Check your connection and try again."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Start your first goal"
          description="A new phone, a trip, an emergency fund — save a little at a time and watch it grow."
          action={
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden="true" />
              Add goal
            </Button>
          }
        />
      ) : (
        <>
          <section aria-label="All goals" className="surface mb-4 p-5">
            <p className="text-sm text-muted-foreground">Saved towards all goals</p>
            <p className="text-3xl font-semibold tracking-tight">
              <AnimatedMoney paise={saved} />
              <span className="text-base font-normal text-muted-foreground">
                {' '}
                of {formatMoney(target)}
              </span>
            </p>
          </section>
          <div className="grid gap-4 sm:grid-cols-2">
            {goals.map((goal, index) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                index={index}
                onAdd={(g) => setContributing({ goal: g, mode: 'add' })}
                onWithdraw={(g) => setContributing({ goal: g, mode: 'withdraw' })}
                onEdit={setEditing}
                onTogglePause={togglePause}
                onDelete={setDeleting}
              />
            ))}
          </div>
          <WhatIfPanel categories={categories} />
        </>
      )}

      <GoalFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        goal={editing === 'new' ? null : editing}
        wallets={wallets}
      />
      <ContributeDialog
        goal={contributing?.goal ?? null}
        mode={contributing?.mode}
        onOpenChange={(open) => !open && setContributing(null)}
        onSaved={afterContribution}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="The goal and its history are removed. Your wallets are not changed."
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
      <Celebration show={celebrating} onDone={stopCelebrating} />
    </>
  );
}
