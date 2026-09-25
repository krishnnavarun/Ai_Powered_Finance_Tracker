import { ArrowRight, LoaderCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TransactionFormDialog } from '@/features/transactions/TransactionFormDialog';
import { useParseText } from './useCapture';

// Dashboard bar: type a payment in plain words, check the filled form, save.
export function QuickAddBar() {
  const [text, setText] = useState('');
  const [draft, setDraft] = useState(null);
  const parse = useParseText();

  const submit = (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    parse.mutate(text.trim(), {
      onSuccess: (result) => {
        setDraft(result.draft);
        setText('');
      },
    });
  };

  return (
    <>
      <form
        onSubmit={submit}
        aria-label="Quick add"
        className="surface flex items-center gap-2 p-2 pl-4 focus-within:ring-2 focus-within:ring-ring/40"
      >
        <Sparkles className="size-4 shrink-0 text-gold" aria-hidden="true" />
        <Input
          aria-label="Describe a payment"
          value={text}
          maxLength={500}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type a payment, e.g. spent 250 on biryani yesterday from GPay"
          aria-invalid={parse.isError || undefined}
          aria-describedby={parse.isError ? 'quick-add-error' : undefined}
          className="border-none bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <Button type="submit" size="sm" disabled={!text.trim() || parse.isPending}>
          {parse.isPending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight aria-hidden="true" />
          )}
          Add
        </Button>
      </form>
      {parse.isError && (
        <p id="quick-add-error" role="alert" className="px-1 text-sm text-destructive">
          {parse.error.message}
        </p>
      )}
      <TransactionFormDialog
        open={draft !== null}
        onOpenChange={(open) => !open && setDraft(null)}
        draft={draft}
      />
    </>
  );
}
