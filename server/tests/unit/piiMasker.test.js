import { describe, expect, it } from 'vitest';
import { maskPII } from '../../src/ai/piiMasker.js';

const masked = (text) => maskPII(text).text;

describe('maskPII', () => {
  it.each([
    // emails and UPI IDs
    ['Receipt sent to asha.rao+bills@gmail.com', 'Receipt sent to [email]'],
    ['Paid to rahul.k@okhdfcbank via GPay', 'Paid to XXXX@okhdfcbank via GPay'],
    ['VPA swiggy.stores@axisbank', 'VPA XXXX@axisbank'],
    // PAN and Aadhaar
    ['PAN ABCDE1234F linked', 'PAN [PAN] linked'],
    ['Aadhaar 1234 5678 9012 verified', 'Aadhaar XXXX XXXX 9012 verified'],
    ['Aadhaar 123456789012', 'Aadhaar XXXX9012'],
    // cards and accounts
    ['Card 4111 1111 1111 1234 charged', 'Card XXXX1234 charged'],
    ['Card 4111-1111-1111-1234', 'Card XXXX1234'],
    ['A/c no. 50100123456789 debited', 'A/c no. XXXX6789 debited'],
    // phones
    ['Call +91 98765 43210 for help', 'Call XXXX3210 for help'],
    ['Call 09876543210', 'Call XXXX3210'],
    ['Call 9876543210.', 'Call XXXX3210.'],
    // OTPs
    ['Your OTP is 482913. Do not share.', 'Your OTP is XXXXXX. Do not share.'],
    ['Verification code: 4821', 'Verification code: XXXXXX'],
  ])('%j → %j', (input, expected) => {
    expect(masked(input)).toBe(expected);
  });

  it('keeps what the AI needs: amounts, dates, masked accounts and shop names', () => {
    const sms =
      'Rs.1,250.00 debited from A/c XX1234 on 24-09-26 to SWIGGY. Avl Bal Rs 45,210.50. UPI Ref 426712345678';
    expect(masked(sms)).toBe(
      'Rs.1,250.00 debited from A/c XX1234 on 24-09-26 to SWIGGY. Avl Bal Rs 45,210.50. UPI Ref XXXX5678',
    );
    expect(masked('INR 150000.00 credited, salary for Sep 2026')).toBe(
      'INR 150000.00 credited, salary for Sep 2026',
    );
    expect(masked('Spent ₹2,49,999 at 7-Eleven on 2026-09-24')).toBe(
      'Spent ₹2,49,999 at 7-Eleven on 2026-09-24',
    );
  });

  it('counts what it hid, without keeping the values', () => {
    const result = maskPII('Paid rahul@okicici from 123456789012, OTP 123456, call 9876543210');
    expect(result.counts).toEqual({ upi: 1, otp: 1, phone: 1, account: 1 });
    expect(JSON.stringify(result.counts)).not.toMatch(/\d{6}/);
  });

  it('handles empty input', () => {
    expect(maskPII('')).toEqual({ text: '', counts: {} });
    expect(maskPII(undefined)).toEqual({ text: '', counts: {} });
  });
});
