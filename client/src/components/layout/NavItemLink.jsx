import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

// A sidebar / sheet link. NavLink adds aria-current="page" to the active one for screen readers.
export function NavItemLink({ item, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {item.label}
    </NavLink>
  );
}
