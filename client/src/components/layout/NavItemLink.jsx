import { m } from 'motion/react';
import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

// A sidebar / sheet link. The highlight behind the active link glides to the newly
// selected page (shared layoutId). NavLink adds aria-current="page" for screen readers.
export function NavItemLink({ item, onNavigate, highlightId = 'sidebar-active' }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
          'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
          isActive
            ? 'text-sidebar-accent-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <m.span
              layoutId={highlightId}
              className="absolute inset-0 rounded-lg bg-sidebar-accent ring-1 ring-primary/15"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          {isActive && (
            <span className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gold" />
          )}
          <Icon
            className="relative size-4 shrink-0 transition-transform duration-200 group-hover:scale-110"
            aria-hidden="true"
          />
          <span className="relative">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}
