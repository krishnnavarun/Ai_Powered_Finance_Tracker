import { QueryClientProvider } from '@tanstack/react-query';
import { domMax, LazyMotion, MotionConfig } from 'motion/react';
import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useSessionBootstrap } from '@/hooks/useSessionBootstrap';
import { useThemeSync } from '@/hooks/useThemeSync';
import { createQueryClient } from '@/lib/queryClient';

// App-wide providers and effects. Shared by the real app and the tests
// (tests pass their own queryClient so each test starts with an empty cache).
export function AppProviders({ children, queryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  useThemeSync();
  useSessionBootstrap();

  return (
    <QueryClientProvider client={client}>
      {/* reducedMotion="user": follows the device's "reduce motion" setting. */}
      <MotionConfig reducedMotion="user">
        <LazyMotion features={domMax}>
          <TooltipProvider>
            {children}
            <Toaster position="top-center" richColors closeButton />
          </TooltipProvider>
        </LazyMotion>
      </MotionConfig>
    </QueryClientProvider>
  );
}
