import { NAV_SECTIONS, SETTINGS_ITEM } from '@/lib/navigation';
import { Logo } from './Logo';
import { NavItemLink } from './NavItemLink';

// Desktop navigation (md and up). Phones use MobileNav instead.
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground backdrop-blur-xl md:flex">
      <div className="flex h-14 items-center px-5">
        <Logo />
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col overflow-y-auto px-3 py-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavItemLink item={item} />
                </li>
              ))}
            </ul>
          </div>
        ))}

        <ul className="mt-auto border-t border-sidebar-border pt-2">
          <li>
            <NavItemLink item={SETTINGS_ITEM} />
          </li>
        </ul>
      </nav>
    </aside>
  );
}
