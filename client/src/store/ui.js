import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { THEME_STORAGE_KEY } from '@/lib/theme';

export const THEMES = ['light', 'dark', 'system'];

// UI-only state that should survive a page reload (saved in localStorage).
export const useUiStore = create(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        if (THEMES.includes(theme)) set({ theme });
      },
    }),
    { name: THEME_STORAGE_KEY, partialize: (state) => ({ theme: state.theme }) },
  ),
);
