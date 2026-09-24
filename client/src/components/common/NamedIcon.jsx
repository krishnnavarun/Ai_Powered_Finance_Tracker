import { createElement } from 'react';
import { iconFor } from '@/lib/icons';
import { cn } from '@/lib/utils';

// Renders a lucide icon from its stored name, e.g. <NamedIcon name="utensils" />.
export function NamedIcon({ name, className, ...props }) {
  return createElement(iconFor(name), {
    className: cn('size-4', className),
    'aria-hidden': 'true',
    ...props,
  });
}

// Round coloured badge with an icon — used for categories and wallets.
export function IconBadge({ icon, color, className }) {
  return (
    <span
      className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', className)}
      style={{ backgroundColor: `${color}22`, color }}
    >
      <NamedIcon name={icon} />
    </span>
  );
}
