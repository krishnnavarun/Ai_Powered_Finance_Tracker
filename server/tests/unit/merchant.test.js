import { describe, expect, it } from 'vitest';
import { normalizeMerchant } from '../../src/utils/merchant.js';

describe('normalizeMerchant', () => {
  it.each([
    ['Swiggy', 'swiggy'],
    ['SWIGGY*Order 8841', 'swiggy order'],
    ['  Zomato   Ltd. ', 'zomato'],
    ['Reliance Retail Pvt. Ltd', 'reliance retail'],
    ['www.amazon.in', 'amazon'],
    ['Café Coffee Day', 'cafe coffee day'],
    ['Uber India Systems Private Limited', 'uber systems'],
    ['BigBasket-12345', 'bigbasket'],
    ['7-Eleven', '7 eleven'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeMerchant(input)).toBe(expected);
  });

  it('returns an empty key for empty input', () => {
    expect(normalizeMerchant('')).toBe('');
    expect(normalizeMerchant(undefined)).toBe('');
    expect(normalizeMerchant('***')).toBe('');
  });
});
