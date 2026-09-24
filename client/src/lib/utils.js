import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Joins class names and resolves Tailwind conflicts: cn('p-2', isBig && 'p-4') → 'p-4'.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
