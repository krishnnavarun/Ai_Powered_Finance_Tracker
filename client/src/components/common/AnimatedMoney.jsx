import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

const DURATION_S = 0.8;

// Money that counts smoothly to its new value (from 0 on first show, then from the
// previous value). Screen readers only get the final amount, never the moving digits.
// With "reduce motion" on, it simply shows the number.
export function AnimatedMoney({ paise, className, decimals }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(reduceMotion ? paise : 0);
  const from = useRef(reduceMotion ? paise : 0);

  useEffect(() => {
    if (reduceMotion) {
      from.current = paise;
      return undefined;
    }
    const controls = animate(from.current, paise, {
      duration: DURATION_S,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (value) => setShown(Math.round(value)),
    });
    from.current = paise;
    return () => controls.stop();
  }, [paise, reduceMotion]);

  const final = formatMoney(paise, { decimals });
  return (
    <span className={cn('tabular-nums', className)}>
      <span aria-hidden="true">{formatMoney(reduceMotion ? paise : shown, { decimals })}</span>
      <span className="sr-only">{final}</span>
    </span>
  );
}
