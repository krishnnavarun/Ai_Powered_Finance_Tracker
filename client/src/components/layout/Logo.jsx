import { IndianRupee } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

export function Logo({ className }) {
  return (
    <Link
      to="/dashboard"
      className={cn('flex items-center gap-2 rounded-md font-semibold tracking-tight', className)}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <IndianRupee className="size-4" aria-hidden="true" />
      </span>
      <span className="text-base">Paisa Pal</span>
    </Link>
  );
}
