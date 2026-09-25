// Small statistics helpers shared by the analytics functions.

export function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

export function mean(values) {
  return values.length ? sum(values) / values.length : 0;
}

// Population standard deviation (the spread of exactly these values).
export function std(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Rounds paise up to the next whole ₹100 (10000 paise): budgets look like ₹4,500, not ₹4,437.12.
export function roundUpToHundredRupees(paise) {
  return Math.ceil(paise / 10000) * 10000;
}
