import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Rupee amount input: shows a ₹ prefix and brings up the number pad on phones.
// The form keeps the typed text; convert it with parseRupeesToPaise before sending.
export function MoneyInput({ className, ref, ...props }) {
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
        aria-hidden="true"
      >
        ₹
      </span>
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        className={cn('pl-7 tabular-nums', className)}
        {...props}
      />
    </div>
  );
}
