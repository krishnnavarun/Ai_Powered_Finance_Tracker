import { useEffect } from 'react';
import { applyTheme, watchSystemTheme } from '@/lib/theme';
import { useUiStore } from '@/store/ui';

// Keeps the <html> class in sync with the chosen theme, and with the OS when theme is 'system'.
export function useThemeSync() {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return undefined;
    return watchSystemTheme(() => applyTheme('system'));
  }, [theme]);
}
