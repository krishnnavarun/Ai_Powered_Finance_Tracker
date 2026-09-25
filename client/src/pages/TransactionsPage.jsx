import { ChevronLeft, ChevronRight, FileUp, Plus, ReceiptText, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Money } from '@/components/common/Money';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategories, useCategoryLookup } from '@/features/categories/useCategories';
import { BulkActionBar } from '@/features/transactions/BulkActionBar';
import { TransactionFilters } from '@/features/transactions/TransactionFilters';
import { TransactionFormDialog } from '@/features/transactions/TransactionFormDialog';
import { TransactionList } from '@/features/transactions/TransactionList';
import { useTransactionFilters } from '@/features/transactions/useTransactionFilters';
import { useTransactionMutations, useTransactions } from '@/features/transactions/useTransactions';
import { useWalletLookup, useWallets } from '@/features/wallets/useWallets';
import { NEW_TRANSACTION_EVENT } from '@/hooks/useShortcuts';
import { useTimeZone } from '@/lib/dates';

export function TransactionsPage() {
  const filters = useTransactionFilters();
  const { data, isPending, isError, refetch, isPlaceholderData } = useTransactions(filters.query);
  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = useCategories();
  const walletLookup = useWalletLookup();
  const categoryLookup = useCategoryLookup();
  const timeZone = useTimeZone();
  const { remove, update, bulk } = useTransactionMutations();

  // `editing` is a transaction, 'new', or null (closed).
  const location = useLocation();
  // Opened with the N key from another page: start with the add dialog open.
  const [editing, setEditing] = useState(() => (location.state?.newTransaction ? 'new' : null));
  // N pressed on this page.
  useEffect(() => {
    const open = () => setEditing('new');
    window.addEventListener(NEW_TRANSACTION_EVENT, open);
    return () => window.removeEventListener(NEW_TRANSACTION_EVENT, open);
  }, []);
  // "/" pressed on another page: put the cursor in the search box.
  useEffect(() => {
    if (location.state?.focusSearch) document.querySelector('[data-shortcut="search"]')?.focus();
  }, [location.state]);
  const [deleting, setDeleting] = useState(null);

  // Ticked rows (ids). Kept while paging, so rows from several pages can be picked.
  const [selected, setSelected] = useState(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = (ids, on) =>
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  const confirmDelete = () =>
    remove.mutate(deleting.id, {
      onSuccess: () => toast.success('Transaction deleted'),
      onError: (error) => toast.error(error.message),
      onSettled: () => setDeleting(null),
    });

  const changeCategory = (txn, categoryId) =>
    update.mutate(
      { id: txn.id, changes: { categoryId } },
      {
        onSuccess: () => toast.success('Category changed'),
        onError: (error) => toast.error(error.message),
      },
    );

  const bulkCategorize = (categoryId, reset) =>
    bulk.mutate(
      { action: 'categorize', ids: [...selected], categoryId },
      {
        onSuccess: ({ updated, skipped }) => {
          toast.success(
            skipped
              ? `Changed ${updated} · skipped ${skipped} of a different type`
              : `Changed ${updated} ${updated === 1 ? 'transaction' : 'transactions'}`,
          );
          clearSelection();
          reset();
        },
        onError: (error) => toast.error(error.message),
      },
    );

  const bulkDelete = () =>
    bulk.mutate(
      { action: 'delete', ids: [...selected] },
      {
        onSuccess: ({ deleted }) => {
          toast.success(`Deleted ${deleted} ${deleted === 1 ? 'transaction' : 'transactions'}`);
          clearSelection();
        },
        onError: (error) => toast.error(error.message),
        onSettled: () => setBulkDeleteOpen(false),
      },
    );

  const transactions = data?.transactions ?? [];
  const { page, totalPages, total } = data?.pagination ?? { page: 1, totalPages: 1, total: 0 };

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Money in and money out"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/import">
                <FileUp aria-hidden="true" />
                Import statement
              </Link>
            </Button>
            <Button onClick={() => setEditing('new')} title="Shortcut: N">
              <Plus aria-hidden="true" />
              Add transaction
            </Button>
          </>
        }
      />

      <TransactionFilters
        filters={filters}
        wallets={wallets}
        categories={categories.filter((c) => !c.isArchived)}
      />

      {data && total > 0 && (
        <section aria-label="Totals" className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-income/10 px-3 py-1 ring-1 ring-income/20">
            <span className="text-muted-foreground">In </span>
            <Money paise={data.totals.income} tone="income" className="font-semibold" />
          </span>
          <span className="rounded-full bg-expense/10 px-3 py-1 ring-1 ring-expense/20">
            <span className="text-muted-foreground">Out </span>
            <Money paise={data.totals.expense} tone="expense" className="font-semibold" />
          </span>
          <span className="px-1 text-muted-foreground">
            {total} {total === 1 ? 'transaction' : 'transactions'}
          </span>
        </section>
      )}

      {isPending ? (
        <div className="grid gap-2" aria-label="Loading transactions">
          {[1, 2, 3, 4, 5].map((n) => (
            <Skeleton key={n} className="h-14" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title="Couldn't load transactions"
          description="Check your connection and try again."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : transactions.length === 0 ? (
        filters.hasFilters ? (
          <EmptyState
            icon={SearchX}
            title="No matching transactions"
            description="Try a different search or clear the filters."
            action={
              <Button variant="outline" onClick={filters.clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ReceiptText}
            title="No transactions yet"
            description="Add your first payment to get started."
            action={
              <Button onClick={() => setEditing('new')}>
                <Plus aria-hidden="true" />
                Add transaction
              </Button>
            }
          />
        )
      ) : (
        <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
          <TransactionList
            transactions={transactions}
            walletLookup={walletLookup}
            categoryLookup={categoryLookup}
            timeZone={timeZone}
            onEdit={setEditing}
            onDelete={setDeleting}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            categories={categories}
            onCategoryChange={changeCategory}
          />

          {totalPages > 1 && (
            <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => filters.setPage(page - 1)}
              >
                <ChevronLeft aria-hidden="true" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => filters.setPage(page + 1)}
              >
                Next
                <ChevronRight aria-hidden="true" />
              </Button>
            </nav>
          )}
        </div>
      )}

      <TransactionFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        transaction={editing === 'new' ? null : editing}
      />
      <BulkActionBar
        count={selected.size}
        categories={categories}
        pending={bulk.isPending}
        onCategorize={bulkCategorize}
        onDelete={() => setBulkDeleteOpen(true)}
        onClear={clearSelection}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} ${selected.size === 1 ? 'transaction' : 'transactions'}?`}
        description="Wallet balances will be fixed for you. This cannot be undone."
        pending={bulk.isPending}
        onConfirm={bulkDelete}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this transaction?"
        description="The wallet balance will be fixed for you. This cannot be undone."
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
