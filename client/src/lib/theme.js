// Theme preference is 'light' | 'dark' | 'system'. 'system' follows the OS setting.
export const THEME_STORAGE_KEY = 'paisa-pal-ui';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches;
}

export function resolveTheme(theme, prefersDark) {
  if (theme === 'system') return prefersDark ? 'dark' : 'light';
  return theme === 'dark' ? 'dark' : 'light';
}

// Adds or removes the `dark` class on <html>; Tailwind's dark: styles key off it.
export function applyTheme(theme) {
  const resolved = resolveTheme(theme, systemPrefersDark());
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  return resolved;
}

// Calls `onChange` whenever the OS switches between light and dark. Returns an unsubscribe function.
export function watchSystemTheme(onChange) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
