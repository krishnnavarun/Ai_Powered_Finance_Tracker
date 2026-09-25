import { CircleAlert, LoaderCircle, MessageSquareText, Sparkles } from 'lucide-react';
import { m } from 'motion/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { FormAlert } from '@/components/common/FormAlert';
import { Money } from '@/components/common/Money';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { categoryOptions } from '@/features/categories/useCategories';
import { useTransactionMutations } from '@/features/transactions/useTransactions';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useParseSms } from './useCapture';

const SKIP_REASONS = {
  otp: 'OTP message',
  promo: 'Offer or advert',
  request: 'Money request, not a payment',
  failed: 'Failed payment',
  future: 'Reminder of a future payment',
  not_transaction: 'Not a payment',
  unknown_format: 'Could not read this format (turn on AI to read more banks)',
};

const TONE = { income: 'income', expense: 'expense' };
const LOW_CONFIDENCE = 0.7;

// One payment found in the SMS, with its wallet and category ready to change.
function ReviewRow({ item, wallets, categories, onChange, index }) {
  const { draft } = item;
  const name = draft.merchant || (draft.type === 'transfer' ? 'Transfer' : 'Payment');
  const needsCheck =
    item.possibleDuplicate || !draft.walletId || draft.aiConfidence < LOW_CONFIDENCE;

  return (
    <m.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className={cn(
        'grid gap-3 rounded-xl border bg-card/80 p-3 transition-opacity',
        !item.selected && 'opacity-60',
        needsCheck && item.selected && 'border-gold/60',
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={item.selected}
          onCheckedChange={(checked) => onChange({ selected: checked === true })}
          aria-label={`Add ${name}`}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {name}
            {item.via === 'ai' && (
              <Badge variant="secondary">
                <Sparkles aria-hidden="true" /> AI
              </Badge>
            )}
            {item.possibleDuplicate && (
              <Badge variant="outline" className="border-gold/60">
                <CircleAlert aria-hidden="true" /> Maybe added already
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(`${draft.date}T00:00:00Z`, 'UTC')}
            {draft.note && ` · ${draft.note}`}
          </p>
        </div>
        <Money
          paise={draft.type === 'expense' ? -draft.amount : draft.amount}
          tone={TONE[draft.type]}
          className="font-semibold"
        />
      </div>
      {item.selected && (
        <div className="grid gap-2 sm:grid-cols-2">
          <NativeSelect
            aria-label={`Wallet for ${name}`}
            value={draft.walletId ?? ''}
            aria-invalid={!draft.walletId || undefined}
            onChange={(event) => onChange({ draft: { walletId: event.target.value || null } })}
          >
            <option value="">Choose a wallet…</option>
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name}
              </option>
            ))}
          </NativeSelect>
          {draft.type !== 'transfer' && (
            <NativeSelect
              aria-label={`Category for ${name}`}
              value={draft.categoryId ?? ''}
              onChange={(event) => onChange({ draft: { categoryId: event.target.value || null } })}
            >
              <option value="">No category</option>
              {categoryOptions(categories, draft.type).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>
      )}
      {item.error && <p className="text-sm text-destructive">{item.error}</p>}
    </m.li>
  );
}

// "Paste SMS" tab: paste one or many bank messages, review what was found, add them.
export function SmsTab({ wallets, categories, onDone }) {
  const [text, setText] = useState('');
  const [items, setItems] = useState(null);
  const [saving, setSaving] = useState(false);
  const parse = useParseSms();
  const { create } = useTransactionMutations();

  const read = (event) => {
    event.preventDefault();
    parse.mutate(text, {
      onSuccess: (result) =>
        setItems(
          result.items.map((item) => ({
            ...item,
            selected: item.status === 'ready' && !item.possibleDuplicate,
          })),
        ),
    });
  };

  const update = (index, changes) =>
    setItems((list) =>
      list.map((item) =>
        item.index === index
          ? { ...item, ...changes, draft: { ...item.draft, ...changes.draft } }
          : item,
      ),
    );

  const ready = items?.filter((item) => item.status === 'ready') ?? [];
  const skipped = items?.filter((item) => item.status === 'skipped') ?? [];
  const chosen = ready.filter((item) => item.selected);
  const missingWallet = chosen.some((item) => !item.draft.walletId);

  const addAll = async () => {
    setSaving(true);
    let added = 0;
    const failed = [];
    for (const item of chosen) {
      const { draft } = item;
      try {
        await create.mutateAsync({
          type: draft.type,
          amount: draft.amount,
          walletId: draft.walletId,
          ...(draft.type === 'transfer'
            ? { toWalletId: draft.toWalletId }
            : { categoryId: draft.categoryId }),
          merchant: draft.merchant,
          note: draft.note,
          date: draft.date,
          source: draft.source,
          aiConfidence: draft.aiConfidence,
        });
        added += 1;
      } catch (error) {
        failed.push({ index: item.index, message: error.message });
      }
    }
    setSaving(false);
    if (added) toast.success(`Added ${added} transaction${added === 1 ? '' : 's'}`);
    if (failed.length) {
      // Keep only the ones that failed, so they can be fixed and tried again.
      setItems((list) =>
        list
          .filter((item) => failed.some((f) => f.index === item.index))
          .map((item) => ({
            ...item,
            error: failed.find((f) => f.index === item.index).message,
          })),
      );
    } else {
      onDone();
    }
  };

  if (!items) {
    return (
      <form onSubmit={read} noValidate className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="sms-text">Paste bank SMS</Label>
          <Textarea
            id="sms-text"
            value={text}
            rows={7}
            autoFocus
            placeholder={
              'Rs.250.00 debited from A/c XX1234 to SWIGGY on 24-09-26…\n\n(Leave an empty line between messages. Up to 50 at a time.)'
            }
            onChange={(event) => setText(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            OTPs and offers are skipped. Nothing is saved until you check and add.
          </p>
        </div>
        <FormAlert>{parse.error?.message}</FormAlert>
        <Button
          type="submit"
          disabled={!text.trim() || parse.isPending}
          className="justify-self-end"
        >
          {parse.isPending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <MessageSquareText aria-hidden="true" />
          )}
          {parse.isPending ? 'Reading…' : 'Read messages'}
        </Button>
      </form>
    );
  }

  return (
    <div className="grid gap-4">
      {ready.length === 0 ? (
        <FormAlert tone="info">No payments found in these messages.</FormAlert>
      ) : (
        <section aria-label="Payments found" className="grid gap-2">
          <p className="text-sm text-muted-foreground">
            Found {ready.length} payment{ready.length === 1 ? '' : 's'}. Untick any you don’t want.
          </p>
          <ul className="grid max-h-[50vh] gap-2 overflow-y-auto pr-1">
            {ready.map((item, i) => (
              <ReviewRow
                key={item.index}
                item={item}
                index={i}
                wallets={wallets}
                categories={categories}
                onChange={(changes) => update(item.index, changes)}
              />
            ))}
          </ul>
        </section>
      )}

      {skipped.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Skipped {skipped.length} message{skipped.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-2 grid gap-1.5">
            {skipped.map((item) => (
              <li key={item.index} className="rounded-lg bg-muted/60 px-3 py-2">
                <span className="font-medium">{SKIP_REASONS[item.reason] ?? 'Skipped'}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.text}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {missingWallet && <FormAlert>Choose a wallet for every ticked payment.</FormAlert>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => setItems(null)} disabled={saving}>
          Paste again
        </Button>
        <Button onClick={addAll} disabled={!chosen.length || missingWallet || saving}>
          {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          Add {chosen.length} transaction{chosen.length === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  );
}
