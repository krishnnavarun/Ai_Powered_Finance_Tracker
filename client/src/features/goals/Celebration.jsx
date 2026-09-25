import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';

const COLORS = ['var(--primary)', 'var(--gold)', 'var(--chart-in)', 'oklch(0.85 0.13 85)'];

// Confetti pieces with fixed, evenly spread directions (worked out once, so renders stay pure).
const PIECES = Array.from({ length: 28 }, (_, i) => {
  const angle = (i / 28) * Math.PI * 2;
  const distance = 140 + (i % 4) * 45;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance - 60,
    rotate: (i % 2 ? 1 : -1) * (180 + i * 25),
    color: COLORS[i % COLORS.length],
    size: 6 + (i % 3) * 3,
    delay: (i % 5) * 0.03,
  };
});

// A short confetti burst when a goal is reached. Skipped entirely for people who prefer
// reduced motion (they still get the toast message).
export function Celebration({ show, onDone }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!show) return undefined;
    const timer = setTimeout(onDone, reduceMotion ? 0 : 1800);
    return () => clearTimeout(timer);
  }, [show, reduceMotion, onDone]);

  return (
    <AnimatePresence>
      {show && !reduceMotion && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
        >
          {PIECES.map((piece, i) => (
            <m.span
              key={i}
              className="absolute rounded-sm"
              style={{ width: piece.size, height: piece.size * 0.6, background: piece.color }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
              animate={{ x: piece.x, y: piece.y + 220, opacity: 0, rotate: piece.rotate, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6, delay: piece.delay, ease: [0.2, 0.7, 0.4, 1] }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
