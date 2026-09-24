import { useId } from 'react';
import { Label } from '@/components/ui/label';

// Label + input + error message, wired together for screen readers:
// the input gets aria-invalid and aria-describedby pointing at the error text.
// `children` is a render function receiving the props to spread on the input.
export function FormField({ label, error, hint, children }) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error?.message ?? hint;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': message ? messageId : undefined,
      })}
      {message && (
        <p
          id={messageId}
          className={error ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'}
        >
          {message}
        </p>
      )}
    </div>
  );
}
