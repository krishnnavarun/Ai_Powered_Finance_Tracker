import { LoaderCircle } from 'lucide-react';

// Shown while the app checks for an existing session on start-up (usually a split second).
export function FullPageLoader({ label = 'Loading Paisa Pal…' }) {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <LoaderCircle className="size-6 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
