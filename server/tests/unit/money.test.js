import { describe, expect, it } from 'vitest';
import { fromPaise, isValidPaise, toPaise } from '../../src/utils/money.js';

describe('toPaise', () => {
  it.each([
    ['250.50', 25050],
    ['250.5', 25050],
    ['250', 25000],
    ['0.01', 1],
    ['0', 0],
    ['₹1,00,000', 10000000],
    ['Rs. 99', 9900],
    ['Rs.1,250.75', 125075],
    ['INR 500', 50000],
    ['  42.10  ', 4210],
    ['-150.25', -15025],
  ])('parses %j → %i', (input, expected) => {
    expect(toPaise(input)).toBe(expected);
  });

  it('parses numbers without floating-point drift', () => {
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise(19.99)).toBe(1999);
    expect(toPaise(1234.56)).toBe(123456);
  });

  it('rounds half-up beyond two decimals', () => {
    expect(toPaise('1.005')).toBe(101);
    expect(toPaise('1.004')).toBe(100);
    expect(toPaise('9.999')).toBe(1000);
  });

  it.each(['', 'abc', '12.34.56', '₹', '1e5', '--5'])('rejects invalid input %j', (input) => {
    expect(() => toPaise(input)).toThrow(/Invalid amount/);
  });

  it('returns 0 (not -0) for negative zero', () => {
    expect(Object.is(toPaise('-0'), 0)).toBe(true);
  });
});

describe('fromPaise', () => {
  it('converts paise to rupees', () => {
    expect(fromPaise(25050)).toBe(250.5);
    expect(fromPaise(1)).toBe(0.01);
  });
});

describe('isValidPaise', () => {
  it('accepts safe integers only', () => {
    expect(isValidPaise(25050)).toBe(true);
    expect(isValidPaise(250.5)).toBe(false);
    expect(isValidPaise('100')).toBe(false);
    expect(isValidPaise(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });
});
