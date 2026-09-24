import { IndianRupee } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

// Emerald coin with a gold rim. `inverted` is for use on the dark emerald panel.
export function Logo({ className, inverted = false }) {
  return (
    <Link
      to="/dashboard"
      className={cn(
        'group flex items-center gap-2 rounded-md font-semibold tracking-tight',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-8 items-center justify-center rounded-xl shadow-md ring-2 ring-gold/60 transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-105',
          inverted
            ? 'bg-primary-foreground text-primary shadow-black/20'
            : 'bg-linear-to-br from-primary to-[color-mix(in_oklab,var(--primary)_70%,black)] text-primary-foreground shadow-primary/30',
        )}
      >
        <IndianRupee className="size-4" aria-hidden="true" />
      </span>
      <span className="text-base">
        Paisa <span className="text-gold-foreground dark:text-gold">Pal</span>
      </span>
    </Link>
  );
}
