import { EyeOff, FileSpreadsheet, Sparkles, ToggleLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const CHOICES = [
  {
    value: true,
    title: 'Yes, use AI',
    text: 'Fill in payments from a typed note, a bank SMS or a receipt photo, and get tips.',
  },
  {
    value: false,
    title: 'No, keep it off',
    text: 'Everything else still works. You add payments yourself.',
  },
];

const FACTS = [
  {
    icon: EyeOff,
    text: 'Card numbers, phone numbers and emails are hidden before anything is sent.',
  },
  { icon: ToggleLeft, text: 'You can turn AI on or off any time in Settings.' },
  {
    icon: FileSpreadsheet,
    text: 'Have a bank statement file (CSV)? You can import it from Transactions later.',
  },
];

// Step 3: the AI switch, explained in plain words.
export function AiStep({ aiEnabled, onChange }) {
  return (
    <div className="grid gap-5">
      <div role="radiogroup" aria-label="Use AI" className="grid gap-3 sm:grid-cols-2">
        {CHOICES.map((choice) => {
          const selected = aiEnabled === choice.value;
          return (
            <button
              key={choice.title}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(choice.value)}
              className={cn(
                'rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]',
                selected
                  ? 'border-primary bg-primary/8 shadow-md shadow-primary/15 ring-1 ring-primary'
                  : 'bg-background/60 hover:border-primary/40',
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                {choice.value && <Sparkles className="size-4 text-gold" aria-hidden="true" />}
                {choice.title}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">{choice.text}</span>
            </button>
          );
        })}
      </div>
      <ul className="grid gap-2.5">
        {FACTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
