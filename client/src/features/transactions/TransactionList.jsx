import { ArrowLeftRight, EllipsisVertical, Paperclip, Pencil, Trash2 } from 'lucide-react';
import { m } from 'motion/react';
import { IconBadge } from '@/components/common/NamedIcon';
import { Money } from '@/components/common/Money';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { categoryOptions } from '@/features/categories/useCategories';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

// Sub-categories are indented in pickers (non-breaking spaces survive in <option>).
const SUB_INDENT = String.fromCharCode(160).repeat(4);

// AI-captured transactions below this confidence are flagged for a second look.
const LOW_CONFIDENCE = 0.7;

// Title, subtitle and icon for one row, using the wallet/category lookups.
function describe(txn, walletLookup, categoryLookup) {
  const wallet = walletLookup.get(txn.walletId);
  const category = categoryLookup.get(txn.categoryId);

  if (txn.type === 'transfer') {
    const to = walletLookup.get(txn.toWalletId);
    return {
      title: txn.note || 'Transfer',
      details: [`${wallet?.name ?? '?'} → ${to?.name ?? '?'}`],
      icon: null,
    };
  }
  const fallback = txn.type === 'income' ? 'Income' : 'Expense';
  return {
    title: txn.merchant || category?.name || fallback,
    details: [txn.merchant ? (category?.name ?? 'Uncategorized') : null, wallet?.name].filter(
      Boolean,
    ),
    icon: category ? { icon: category.icon, color: category.color } : null,
  };
}

function TransactionRow({
  txn,
  index,
  selected,
  onToggle,
  categories,
  onCategoryChange,
  walletLookup,
  categoryLookup,
  timeZone,
  onEdit,
  onDelete,
}) {
  const { title, details, icon } = describe(txn, walletLookup, categoryLookup);
  const tone = txn.type === 'transfer' ? undefined : txn.type;
  const needsCheck = txn.aiConfidence !== null && txn.aiConfidence < LOW_CONFIDENCE;
  const date = formatDate(txn.date, timeZone);
  const checkboxId = `select-${txn.id}`;

  return (
    // Rows slide in one after another (capped so long pages don't wait).
    <m.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3), ease: 'easeOut' }}
      className={cn(
        'flex items-center gap-2 border-b border-border/60 pl-2 transition-colors duration-200 last:border-b-0',
        selected && 'bg-primary/6',
      )}
    >
      <Checkbox
        id={checkboxId}
        checked={selected}
        onCheckedChange={() => onToggle(txn.id)}
        aria-label={`Select ${title}`}
      />
      <button
        type="button"
        onClick={() => onEdit(txn)}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors duration-200 hover:bg-primary/6 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.99]"
        aria-label={`Edit ${title}, ${formatMoney(txn.amount)}, ${date}`}
      >
        {icon ? (
          <IconBadge icon={icon.icon} color={icon.color} />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ArrowLeftRight className="size-4" aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{title}</span>
            {txn.receiptUrl && (
              <Paperclip
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-label="Has receipt"
              />
            )}
            {needsCheck && (
              <Badge
                variant="outline"
                className="border-amber-500/50 text-amber-700 dark:text-amber-400"
              >
                Check
              </Badge>
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {[...details, date].join(' · ')}
          </span>
        </span>
        <Money paise={txn.amount} tone={tone} className="font-medium whitespace-nowrap" />
      </button>

      {/* Quick category change on wider screens (phones use the edit form). */}
      <div className="hidden w-44 shrink-0 md:block">
        {txn.type !== 'transfer' && (
          <NativeSelect
            aria-label={`Category for ${title}`}
            className="h-8 text-xs"
            value={txn.categoryId ?? ''}
            onChange={(event) => onCategoryChange(txn, event.target.value || null)}
          >
            <option value="">No category</option>
            {categoryOptions(categories, txn.type).map((c) => (
              <option key={c.id} value={c.id}>
                {c.depth ? `${SUB_INDENT}${c.name}` : c.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${title}`}>
            <EllipsisVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit(txn)}>
            <Pencil aria-hidden="true" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(txn)}>
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </m.li>
  );
}

// selected: Set of selected ids. onToggleAll selects / clears every row on this page.
export function TransactionList({ transactions, selected, onToggleAll, ...rowProps }) {
  const selectedHere = transactions.filter((txn) => selected.has(txn.id)).length;
  const allState =
    selectedHere === 0 ? false : selectedHere === transactions.length ? true : 'indeterminate';

  return (
    <div className="surface px-2">
      <div className="flex items-center gap-3 border-b border-border/60 px-2 py-2.5">
        <Checkbox
          id="select-all"
          checked={allState}
          onCheckedChange={() =>
            onToggleAll(
              transactions.map((txn) => txn.id),
              allState !== true,
            )
          }
        />
        <Label
          htmlFor="select-all"
          className="cursor-pointer text-xs font-normal text-muted-foreground"
        >
          Select all on this page
        </Label>
      </div>
      <ul aria-label="Transactions">
        {transactions.map((txn, index) => (
          <TransactionRow
            key={txn.id}
            txn={txn}
            index={index}
            selected={selected.has(txn.id)}
            {...rowProps}
          />
        ))}
      </ul>
    </div>
  );
}
