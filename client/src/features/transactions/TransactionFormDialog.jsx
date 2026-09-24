import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle, Wallet } from 'lucide-react';
import { m } from 'motion/react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { EmptyState } from '@/components/common/EmptyState';
import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { MoneyInput } from '@/components/common/MoneyInput';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { categoryOptions, useCategories } from '@/features/categories/useCategories';
import { useWallets } from '@/features/wallets/useWallets';
import { toLocalDate, useTimeZone } from '@/lib/dates';
import { paiseToInput, parseRupeesToPaise } from '@/lib/money';
import { applyServerErrors } from '@/lib/serverErrors';
import { cn } from '@/lib/utils';
import { ReceiptField } from './ReceiptField';
import { useTransactionMutations } from './useTransactions';

// Text colour of the selected type, so it reads at a glance (the label says it too).
const TYPE_COLORS = {
  expense: 'text-expense',
  income: 'text-income',
  transfer: 'text-gold-foreground dark:text-gold',
};

const TYPES = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
];
// Sub-categories are indented in the picker (non-breaking spaces survive in <option>).
const SUB_INDENT = String.fromCharCode(160).repeat(4);
const FIELDS = [
  'type',
  'amount',
  'walletId',
  'toWalletId',
  'categoryId',
  'date',
  'merchant',
  'note',
  'tags',
];

const schema = z
  .object({
    type: z.enum(['expense', 'income', 'transfer']),
    amount: z
      .string()
      .trim()
      .min(1, 'Enter an amount')
      .refine((value) => (parseRupeesToPaise(value) ?? 0) > 0, 'Enter an amount above ₹0'),
    walletId: z.string().min(1, 'Choose a wallet'),
    toWalletId: z.string(),
    categoryId: z.string(),
    date: z.string().min(1, 'Choose a date'),
    merchant: z.string().trim().max(100, 'Too long'),
    note: z.string().trim().max(500, 'Too long'),
    tags: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.type !== 'transfer') return;
    if (!values.toWalletId) {
      ctx.addIssue({ code: 'custom', path: ['toWalletId'], message: 'Choose a wallet' });
    } else if (values.toWalletId === values.walletId) {
      ctx.addIssue({ code: 'custom', path: ['toWalletId'], message: 'Choose a different wallet' });
    }
  });

// "Food, friends , food" → ["food", "friends"]
function parseTags(text) {
  return [
    ...new Set(
      text
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function toFormValues(txn, { defaultWalletId, timeZone }) {
  return {
    type: txn?.type ?? 'expense',
    amount: paiseToInput(txn?.amount ?? null),
    walletId: txn?.walletId ?? defaultWalletId ?? '',
    toWalletId: txn?.toWalletId ?? '',
    categoryId: txn?.categoryId ?? '',
    date: toLocalDate(txn ? txn.date : new Date(), timeZone),
    merchant: txn?.merchant ?? '',
    note: txn?.note ?? '',
    tags: txn?.tags?.join(', ') ?? '',
  };
}

// Only fields the user changed are sent when editing, so e.g. an untouched date keeps
// its exact time instead of being reset to midnight.
function toPayload(values, { dirtyFields, isEdit }) {
  const payload = {
    type: values.type,
    amount: parseRupeesToPaise(values.amount),
    walletId: values.walletId,
    date: values.date,
    merchant: values.merchant,
    note: values.note,
    tags: parseTags(values.tags),
  };
  if (values.type === 'transfer') payload.toWalletId = values.toWalletId;
  else payload.categoryId = values.categoryId || null;

  if (!isEdit) return payload;
  const changed = Object.keys(dirtyFields);
  return Object.fromEntries(Object.entries(payload).filter(([key]) => changed.includes(key)));
}

function TransactionForm({ transaction, wallets, categories, onDone }) {
  const timeZone = useTimeZone();
  const isEdit = Boolean(transaction);
  const activeWallets = wallets.filter(
    (w) => !w.isArchived || w.id === transaction?.walletId || w.id === transaction?.toWalletId,
  );
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(transaction, { defaultWalletId: activeWallets[0]?.id, timeZone }),
  });
  const { create, update, uploadReceipt, removeReceipt } = useTransactionMutations();
  const mutation = isEdit ? update : create;
  const { errors, dirtyFields } = form.formState;
  const type = useWatch({ control: form.control, name: 'type' });
  // Receipt change: { file } = new photo, { remove: true } = delete it, null = no change.
  const [receipt, setReceipt] = useState(null);
  const saving =
    create.isPending || update.isPending || uploadReceipt.isPending || removeReceipt.isPending;

  const options = categoryOptions(categories, type);
  // Keep showing an archived category that this transaction already uses.
  const current = categories.find((c) => c.id === transaction?.categoryId);
  if (current?.isArchived && current.type === type) options.push({ ...current, depth: 0 });

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = toPayload(values, { dirtyFields, isEdit });
    const hasChanges = Object.keys(payload).length > 0;
    if (isEdit && !hasChanges && !receipt) return onDone(); // nothing changed

    // 1. Save the transaction itself.
    let saved = transaction;
    try {
      if (!isEdit) saved = await create.mutateAsync(payload);
      else if (hasChanges)
        saved = await update.mutateAsync({ id: transaction.id, changes: payload });
    } catch (error) {
      applyServerErrors(form, error, FIELDS);
      return;
    }

    // 2. Then the photo. If only this fails, the transaction is already saved — say so
    //    instead of keeping the form open (saving again would create a duplicate).
    try {
      if (receipt?.file) await uploadReceipt.mutateAsync({ id: saved.id, file: receipt.file });
      else if (receipt?.remove) await removeReceipt.mutateAsync(saved.id);
      toast.success(isEdit ? 'Transaction saved' : 'Transaction added');
    } catch (error) {
      toast.error(`Transaction saved, but the photo failed: ${error.message}`);
    }
    onDone();
  });

  const fieldError = mutation.error?.code === 'VALIDATION_ERROR';
  const walletOptions = activeWallets.map((wallet) => (
    <option key={wallet.id} value={wallet.id}>
      {wallet.name}
    </option>
  ));

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormAlert>{fieldError ? null : mutation.error?.message}</FormAlert>

      <fieldset>
        <legend className="sr-only">Type</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/80 p-1">
          {TYPES.map((option) => (
            <label key={option.value} className="relative cursor-pointer">
              <input
                type="radio"
                value={option.value}
                className="peer sr-only"
                {...form.register('type', {
                  // A category of the old type no longer fits.
                  onChange: () => form.setValue('categoryId', '', { shouldDirty: true }),
                })}
              />
              {/* The white highlight slides to the chosen type. */}
              {type === option.value && (
                <m.span
                  layoutId="type-highlight"
                  className="absolute inset-0 rounded-lg bg-background shadow-sm ring-1 ring-border"
                  transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                />
              )}
              <span
                className={cn(
                  'relative block rounded-lg py-1.5 text-center text-sm font-medium text-muted-foreground transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                  type === option.value && TYPE_COLORS[option.value],
                )}
              >
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Amount" error={errors.amount}>
          {(field) => <MoneyInput {...field} autoFocus={!isEdit} {...form.register('amount')} />}
        </FormField>
        <FormField label="Date" error={errors.date}>
          {(field) => <Input {...field} type="date" {...form.register('date')} />}
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={type === 'transfer' ? 'From wallet' : 'Wallet'} error={errors.walletId}>
          {(field) => (
            <NativeSelect {...field} {...form.register('walletId')}>
              {walletOptions}
            </NativeSelect>
          )}
        </FormField>

        {type === 'transfer' ? (
          <FormField label="To wallet" error={errors.toWalletId}>
            {(field) => (
              <NativeSelect {...field} {...form.register('toWalletId')}>
                <option value="">Choose…</option>
                {walletOptions}
              </NativeSelect>
            )}
          </FormField>
        ) : (
          <FormField label="Category" error={errors.categoryId}>
            {(field) => (
              <NativeSelect {...field} {...form.register('categoryId')}>
                <option value="">No category</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.depth ? `${SUB_INDENT}${c.name}` : c.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        )}
      </div>

      {type !== 'transfer' && (
        <FormField
          label={type === 'income' ? 'From (optional)' : 'Where (optional)'}
          error={errors.merchant}
        >
          {(field) => (
            <Input
              {...field}
              placeholder={type === 'income' ? 'Employer or client' : 'Swiggy, DMart, Uber…'}
              {...form.register('merchant')}
            />
          )}
        </FormField>
      )}

      <FormField label="Note (optional)" error={errors.note}>
        {(field) => <Input {...field} {...form.register('note')} />}
      </FormField>

      <FormField
        label="Tags (optional)"
        error={errors.tags}
        hint="Separate with commas, e.g. trip, friends"
      >
        {(field) => <Input {...field} {...form.register('tags')} />}
      </FormField>

      {type !== 'transfer' && (
        <ReceiptField transaction={transaction} value={receipt} onChange={setReceipt} />
      )}

      <DialogFooter className="mt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {isEdit ? 'Save changes' : 'Add transaction'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Add a transaction (transaction = null) or edit one.
export function TransactionFormDialog({ open, onOpenChange, transaction }) {
  const wallets = useWallets({ includeArchived: true });
  const categories = useCategories();
  const close = () => onOpenChange(false);
  const hasWallets = (wallets.data ?? []).some((w) => !w.isArchived);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{transaction ? 'Edit transaction' : 'Add a transaction'}</DialogTitle>
          <DialogDescription>
            {transaction
              ? 'Your wallet balance updates by itself.'
              : 'Add money you spent, got or moved.'}
          </DialogDescription>
        </DialogHeader>

        {wallets.isPending || categories.isPending ? (
          <LoaderCircle
            className="mx-auto my-8 size-6 animate-spin text-primary"
            aria-label="Loading"
          />
        ) : !hasWallets && !transaction ? (
          <EmptyState
            icon={Wallet}
            title="Add a wallet first"
            description="Every payment needs a wallet, like cash or a bank account."
            action={
              <Button asChild onClick={close}>
                <Link to="/wallets">Go to wallets</Link>
              </Button>
            }
          />
        ) : (
          <TransactionForm
            key={transaction?.id ?? 'new'}
            transaction={transaction}
            wallets={wallets.data}
            categories={categories.data}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
