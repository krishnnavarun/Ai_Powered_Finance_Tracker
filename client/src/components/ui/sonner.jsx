import { Toaster as Sonner } from 'sonner';
import { resolveTheme, systemPrefersDark } from '@/lib/theme';
import { useUiStore } from '@/store/ui';

// shadcn's toaster, wired to our own theme store instead of next-themes.
// Show a toast anywhere with: import { toast } from 'sonner'; toast.success('Saved');
function Toaster(props) {
  const theme = useUiStore((state) => resolveTheme(state.theme, systemPrefersDark()));

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={{
        '--normal-bg': 'var(--popover)',
        '--normal-text': 'var(--popover-foreground)',
        '--normal-border': 'var(--border)',
      }}
      {...props}
    />
  );
}

export { Toaster };
