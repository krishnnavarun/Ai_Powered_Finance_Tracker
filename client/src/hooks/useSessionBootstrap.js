import { useEffect } from 'react';
import { refreshSession } from '@/api/client';
import { useAuthStore } from '@/store/auth';

// On app start, try to restore the session from the refresh cookie. Success →
// 'authenticated'; no cookie or expired → 'anonymous'. Runs once; the shared
// refresh promise also covers React StrictMode's double effect in development.
export function useSessionBootstrap() {
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status === 'loading') refreshSession().catch(() => {});
  }, [status]);
}
