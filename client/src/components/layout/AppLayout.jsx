import { m } from 'motion/react';
import { Outlet, useLocation } from 'react-router';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useShortcuts } from '@/hooks/useShortcuts';
import { AuroraBackground } from './AuroraBackground';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout() {
  useDocumentTitle();
  useShortcuts();
  const { pathname } = useLocation();

  return (
    <div className="min-h-dvh">
      <AuroraBackground />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>

      <Sidebar />

      <div className="flex min-h-dvh flex-col md:pl-60">
        <Topbar />
        {/* Bottom padding on phones keeps content clear of the tab bar. */}
        <main id="main" className="flex-1 px-4 pt-6 pb-28 md:px-8 md:pb-10">
          {/* Each page fades and rises in gently when you open it. */}
          <m.div
            key={pathname}
            className="mx-auto w-full max-w-6xl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <Outlet />
          </m.div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
