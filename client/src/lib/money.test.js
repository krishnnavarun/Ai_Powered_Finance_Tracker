import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyCompact, paiseToInput, parseRupeesToPaise } from './money';

describe('paiseToInput', () => {
  it.each([
    [250050, '2500.50'],
    [250000, '2500'],
    [5, '0.05'],
    [-120000, '-1200'],
    [0, '0'],
    [null, ''],
  ])('%j → %j', (paise, expected) => {
    expect(paiseToInput(paise)).toBe(expected);
  });

  it('round-trips with parseRupeesToPaise', () => {
    for (const paise of [1, 99, 100, 123456789, -5001]) {
      expect(parseRupeesToPaise(paiseToInput(paise))).toBe(paise);
    }
  });
});

describe('formatMoney', () => {
  it('uses Indian digit grouping', () => {
    expect(formatMoney(10000000)).toBe('₹1,00,000');
    expect(formatMoney(1234567800)).toBe('₹1,23,45,678');
  });

  it('shows decimals only when needed in auto mode', () => {
    expect(formatMoney(25050)).toBe('₹250.50');
    expect(formatMoney(25000)).toBe('₹250');
  });

  it('always shows decimals when asked', () => {
    expect(formatMoney(25000, { decimals: 'always' })).toBe('₹250.00');
  });

  it('formats negatives and zero', () => {
    expect(formatMoney(-15025)).toBe('-₹150.25');
    expect(formatMoney(0)).toBe('₹0');
  });
});

describe('parseRupeesToPaise', () => {
  it.each([
    ['250.50', 25050],
    ['250.5', 25050],
    ['1,00,000', 10000000],
    ['₹99', 9900],
    [' 0.01 ', 1],
    ['-10', -1000],
  ])('parses %j → %i', (input, expected) => {
    expect(parseRupeesToPaise(input)).toBe(expected);
  });

  it.each(['', 'abc', '1.234', '12.', '1e3'])('returns null for %j', (input) => {
    expect(parseRupeesToPaise(input)).toBeNull();
  });
});

describe('formatMoneyCompact', () => {
  it.each([
    [95000, '₹950'],
    [4500000, '₹45K'],
    [12000000, '₹1.2L'],
    [2500000000, '₹2.5Cr'],
  ])('%i paise → %s', (paise, expected) => {
    expect(formatMoneyCompact(paise)).toBe(expected);
  });
});
