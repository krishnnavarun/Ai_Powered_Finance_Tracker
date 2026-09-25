import { describe, expect, it } from 'vitest';
import { findDate, parseSms, splitMessages } from '../../src/ai/parsers/smsParser.js';
import { SKIPPED_SMS, TRANSACTION_SMS } from '../fixtures/sms.js';

describe('parseSms', () => {
  it.each(TRANSACTION_SMS)('reads $name', ({ text, expected }) => {
    expect(parseSms(text)).toMatchObject({ status: 'parsed', ...expected });
  });

  it.each(SKIPPED_SMS)('skips a $reason message', ({ text, reason }) => {
    expect(parseSms(text)).toEqual({ status: 'skipped', reason });
  });

  it('hands money-looking messages in unknown formats to the AI', () => {
    expect(parseSms('Your wallet balance of Rs.120 changed recently.')).toEqual({
      status: 'unknown',
    });
  });

  it('ignores balances and limits when looking for the amount', () => {
    const sms = 'Avl Bal Rs.9,000.00. Rs.150.00 debited from A/c XX1234 to CHAAYOS on 24-09-26';
    expect(parseSms(sms)).toMatchObject({ amount: 15000, balance: 900000 });
  });
});

describe('findDate', () => {
  it.each([
    ['on 24-09-26', '2026-09-24'],
    ['on 24/09/2026', '2026-09-24'],
    ['on 24-Sep-26', '2026-09-24'],
    ['on 24Sep26', '2026-09-24'],
    ['on 3 OCT 2026', '2026-10-03'],
    ['at 2026-09-24:10:22', '2026-09-24'],
    ['on 31-02-26', null],
    ['no date here', null],
  ])('%j → %j', (text, expected) => expect(findDate(text)).toBe(expected));
});

describe('splitMessages', () => {
  it('splits on blank lines and keeps multi-line messages together', () => {
    const pasted = `${TRANSACTION_SMS[0].text}\n\n  \n${TRANSACTION_SMS[2].text}\r\n\r\n${TRANSACTION_SMS[3].text}`;
    const messages = splitMessages(pasted);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toBe(TRANSACTION_SMS[0].text);
  });

  it('keeps at most 50 messages', () => {
    expect(splitMessages(Array(60).fill('Rs.1 debited').join('\n\n'))).toHaveLength(50);
  });
});
