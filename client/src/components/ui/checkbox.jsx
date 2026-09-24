import { m } from 'motion/react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

const draw = { duration: 0.35, ease: 'easeOut' };

// Accessible checkbox (Radix). Use it controlled (`checked` + `onCheckedChange`):
// the tick draws itself with a small bounce; checked="indeterminate" shows a dash
// (e.g. "some rows on this page are selected").
function Checkbox({ className, checked, ...props }) {
  const state = checked === 'indeterminate' ? 'dash' : checked ? 'tick' : 'off';

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={checked}
      className={cn(
        'peer size-5 shrink-0 rounded-md border border-input bg-background/60 shadow-xs transition-[background-color,border-color,box-shadow,transform] duration-200 outline-none hover:border-primary/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-90 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:shadow-md data-[state=checked]:shadow-primary/30 data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground dark:bg-input/30',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator forceMount className="flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
          <m.path
            d="M4 12.5l5 5L20 6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={
              state === 'tick'
                ? { pathLength: 1, opacity: 1, scale: [0.6, 1.15, 1] }
                : { pathLength: 0, opacity: 0, scale: 0.6 }
            }
            transition={draw}
          />
          <m.path
            d="M6 12h12"
            fill="none"
            stroke="currentColor"
            strokeWidth={3.2}
            strokeLinecap="round"
            initial={false}
            animate={
              state === 'dash' ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }
            }
            transition={draw}
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
