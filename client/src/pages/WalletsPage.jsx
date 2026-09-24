import { ArrowLeftRight, Landmark, Plus, Wallet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AnimatedMoney } from '@/components/common/AnimatedMoney';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { TransferDialog } from '@/features/wallets/TransferDialog';
import { useWalletMutations, useWallets } from '@/features/wallets/useWallets';
import { WalletCard } from '@/features/wallets/WalletCard';
import { WalletFormDialog } from '@/features/wallets/WalletFormDialog';

export function WalletsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const {
    data: wallets = [],
    isPending,
    isError,
    refetch,
  } = useWallets({
    includeArchived: showArchived,
  });
  const { update, remove } = useWalletMutations();

  // Dialog state: `editing` is a wallet, 'new', or null (closed).
  const [editing, setEditing] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const active = wallets.filter((wallet) => !wallet.isArchived);
  const total = active.reduce((sum, wallet) => sum + wallet.balance, 0);

  const toggleArchive = (wallet) => {
    const isArchived = !wallet.isArchived;
    update.mutate(
      { id: wallet.id, changes: { isArchived } },
      {
        onSuccess: () =>
          toast.success(isArchived ? `Archived "${wallet.name}"` : `Restored "${wallet.name}"`, {
            action: isArchived
              ? {
                  label: 'Undo',
                  onClick: () => update.mutate({ id: wallet.id, changes: { isArchived: false } }),
                }
              : undefined,
          }),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const confirmDelete = () =>
    remove.mutate(deleting.id, {
      onSuccess: () => toast.success(`Deleted "${deleting.name}"`),
      // e.g. "This wallet has transactions. Archive it to hide it…"
      onError: (error) => toast.error(error.message),
      onSettled: () => setDeleting(null),
    });

  return (
    <>
      <PageHeader
        title="Wallets"
        description="Where your money is kept"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setTransferOpen(true)}
              disabled={active.length < 2}
            >
              <ArrowLeftRight aria-hidden="true" />
              Move money
            </Button>
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden="true" />
              Add wallet
            </Button>
          </>
        }
      />

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading wallets">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title="Couldn't load your wallets"
          description="Check your connection and try again."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : wallets.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Add your first wallet"
          description="Start with your cash or your bank account."
          action={
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden="true" />
              Add wallet
            </Button>
          }
        />
      ) : (
        <>
          <section aria-label="Total" className="surface mb-6 flex items-center gap-4 p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold/20 text-gold-foreground ring-1 ring-gold/40 dark:text-gold">
              <Landmark className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">
                Total in {active.length} {active.length === 1 ? 'wallet' : 'wallets'}
              </p>
              <p className="text-3xl font-semibold tracking-tight">
                <AnimatedMoney paise={total} />
              </p>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wallets.map((wallet, index) => (
              <WalletCard
                key={wallet.id}
                index={index}
                wallet={wallet}
                onEdit={setEditing}
                onToggleArchive={toggleArchive}
                onDelete={setDeleting}
              />
            ))}
          </div>
        </>
      )}

      <div className="mt-6 flex w-fit items-center gap-2.5">
        <Checkbox
          id="show-archived"
          checked={showArchived}
          onCheckedChange={(checked) => setShowArchived(checked === true)}
        />
        <Label htmlFor="show-archived" className="cursor-pointer font-normal text-muted-foreground">
          Show archived wallets
        </Label>
      </div>

      <WalletFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        wallet={editing === 'new' ? null : editing}
      />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} wallets={active} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="This cannot be undone. A wallet with payments can only be archived."
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
