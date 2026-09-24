import { Tags, Trash2, X } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';

// Floating bar that slides up while transactions are selected.
export function BulkActionBar({ count, categories, onCategorize, onDelete, onClear, pending }) {
  const [categoryId, setCategoryId] = useState('');
  const expense = categories.filter((c) => c.type === 'expense' && !c.isArchived);
  const income = categories.filter((c) => c.type === 'income' && !c.isArchived);

  return (
    <AnimatePresence>
      {count > 0 && (
        <m.section
          aria-label="Selected transactions"
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-background/85 p-3 shadow-2xl shadow-black/15 backdrop-blur-xl md:bottom-6 md:left-60"
        >
          <span className="px-1 text-sm font-medium">{count} selected</span>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="min-w-0 flex-1">
              <NativeSelect
                aria-label="New category for selected"
                className="h-8 text-xs"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Change category…</option>
                <optgroup label="Expense">
                  {expense.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Income">
                  {income.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              </NativeSelect>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!categoryId || pending}
              onClick={() => onCategorize(categoryId, () => setCategoryId(''))}
            >
              <Tags aria-hidden="true" />
              Apply
            </Button>
          </div>

          <Button size="sm" variant="destructive" disabled={pending} onClick={onDelete}>
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
            <X aria-hidden="true" />
          </Button>
        </m.section>
      )}
    </AnimatePresence>
  );
}
