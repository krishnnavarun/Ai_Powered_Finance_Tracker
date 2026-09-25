import { LoaderCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { FormAlert } from '@/components/common/FormAlert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAiStatus, useParseText } from './useCapture';

const EXAMPLES = [
  'spent 250 on biryani yesterday from GPay',
  'got salary 60k',
  'paid 1200 electricity bill from HDFC',
  'uber 180 last friday',
];

// "Type it" tab: describe a payment in your own words; it comes back as a filled form.
export function TypeItTab({ onDraft }) {
  const [text, setText] = useState('');
  const parse = useParseText();
  const { data: ai } = useAiStatus();
  const aiOn = ai?.enabled && ai?.configured;

  const submit = (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    parse.mutate(text.trim(), { onSuccess: ({ draft }) => onDraft(draft) });
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="type-it">Describe the payment</Label>
        <Textarea
          id="type-it"
          value={text}
          maxLength={500}
          rows={3}
          autoFocus
          placeholder="spent 250 on biryani with Rahul yesterday from GPay"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) submit(event);
          }}
        />
        <p className="text-xs text-muted-foreground">
          {aiOn
            ? 'AI reads it and fills in the form. Card and phone numbers are hidden first.'
            : 'Simple reading is used (AI is off), so check the form carefully.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="Examples">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setText(example)}
            className="rounded-full border bg-background/60 px-2.5 py-1 text-xs text-muted-foreground transition-all duration-200 hover:-translate-y-px hover:border-primary/40 hover:text-foreground active:scale-95"
          >
            {example}
          </button>
        ))}
      </div>

      <FormAlert>{parse.error?.message}</FormAlert>

      <Button type="submit" disabled={!text.trim() || parse.isPending} className="justify-self-end">
        {parse.isPending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles aria-hidden="true" />
        )}
        {parse.isPending ? 'Reading…' : 'Fill in the form'}
      </Button>
    </form>
  );
}
