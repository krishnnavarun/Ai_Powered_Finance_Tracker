import { Ellipsis } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { MOBILE_ITEMS, MORE_ITEMS } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { NavItemLink } from './NavItemLink';

const tabClass =
  'flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md';

// Bottom tab bar for phones: the 4 most used pages plus a "More" sheet for the rest.
export function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const moreActive = MORE_ITEMS.some((item) => pathname.startsWith(item.path));

  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5 px-2">
        {MOBILE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn(tabClass, isActive ? 'text-primary' : 'text-muted-foreground')
                }
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </NavLink>
            </li>
          );
        })}

        <li>
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger
              className={cn(
                tabClass,
                'w-full',
                moreActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Ellipsis className="size-5" aria-hidden="true" />
              More
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-xl pb-[env(safe-area-inset-bottom)]">
              <SheetHeader>
                <SheetTitle>More</SheetTitle>
              </SheetHeader>
              <ul className="grid gap-1 px-3 pb-4">
                {MORE_ITEMS.map((item) => (
                  <li key={item.path}>
                    <NavItemLink item={item} onNavigate={() => setMoreOpen(false)} />
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
