import { Ellipsis } from 'lucide-react';
import { m } from 'motion/react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { MOBILE_ITEMS, MORE_ITEMS } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { NavItemLink } from './NavItemLink';

const tabClass =
  'relative flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95';

// The highlight that slides to the active tab.
function ActivePill() {
  return (
    <m.span
      layoutId="mobile-active"
      className="absolute inset-0 -z-10 rounded-xl bg-primary/12 ring-1 ring-primary/15"
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
    />
  );
}

// Floating glass tab bar for phones: the 4 most used pages plus a "More" sheet.
export function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const moreActive = MORE_ITEMS.some((item) => pathname.startsWith(item.path));

  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-3 bottom-3 z-30 mb-[env(safe-area-inset-bottom)] rounded-2xl border border-border/70 bg-background/70 shadow-xl shadow-black/10 backdrop-blur-xl md:hidden"
    >
      <ul className="isolate grid grid-cols-5 gap-1 p-1.5">
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
                {({ isActive }) => (
                  <>
                    {isActive && <ActivePill />}
                    <Icon className="size-5" aria-hidden="true" />
                    {item.label}
                  </>
                )}
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
              {moreActive && <ActivePill />}
              <Ellipsis className="size-5" aria-hidden="true" />
              More
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="rounded-t-2xl bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
            >
              <SheetHeader>
                <SheetTitle>More</SheetTitle>
              </SheetHeader>
              <ul className="grid gap-1 px-3 pb-4">
                {MORE_ITEMS.map((item) => (
                  <li key={item.path}>
                    <NavItemLink
                      item={item}
                      highlightId="more-active"
                      onNavigate={() => setMoreOpen(false)}
                    />
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
