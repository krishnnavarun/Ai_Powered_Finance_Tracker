import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// A styled native <select>. Native selects work everywhere (phone pickers, screen
// readers, keyboard) with no extra code, which suits short option lists like wallets.
function NativeSelect({ className, children, ref, ...props }) {
  return (
    <div className="relative">
      <select
        ref={ref}
        data-slot="native-select"
        className={cn(
          'h-9 w-full min-w-0 appearance-none rounded-lg border border-input bg-background/60 py-1 pr-9 pl-3 text-base shadow-xs transition-[color,box-shadow,border-color] duration-200 outline-none hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}

export { NativeSelect };
