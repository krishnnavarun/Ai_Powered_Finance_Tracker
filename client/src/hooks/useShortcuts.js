import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

export const NEW_TRANSACTION_EVENT = 'paisa-pal:new-transaction';

// True while the user is typing somewhere, or a dialog/menu is open.
function busy(event) {
  const target = event.target;
  if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) {
    return true;
  }
  return Boolean(document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]'));
}

// App-wide keys: N = add a transaction, / = search transactions.
export function useShortcuts() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    const onKey = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || busy(event)) return;
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        if (pathname === '/transactions') {
          window.dispatchEvent(new Event(NEW_TRANSACTION_EVENT));
        } else {
          navigate('/transactions', { state: { newTransaction: true } });
        }
      } else if (event.key === '/') {
        event.preventDefault();
        const search = document.querySelector('[data-shortcut="search"]');
        if (search) search.focus();
        else navigate('/transactions', { state: { focusSearch: true } });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, pathname]);
}
