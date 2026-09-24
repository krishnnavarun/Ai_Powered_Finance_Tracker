import { CircleAlert } from 'lucide-react';

// Error box for problems that don't belong to one field (wrong password, server down…).
// role="alert" makes screen readers announce it as soon as it appears.
export function FormAlert({ children }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
