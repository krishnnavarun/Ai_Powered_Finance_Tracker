import { useEffect } from 'react';
import { Outlet, useMatches } from 'react-router';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

// Sets the browser tab title from the current route's `handle.title`.
function useDocumentTitle() {
  const matches = useMatches();
  const title = [...matches].reverse().find((match) => match.handle?.title)?.handle.title;

  useEffect(() => {
    document.title = title ? `${title} · Paisa Pal` : 'Paisa Pal';
  }, [title]);
}

export function AppLayout() {
  useDocumentTitle();

  return (
    <div className="min-h-dvh">
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
        <main id="main" className="flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
