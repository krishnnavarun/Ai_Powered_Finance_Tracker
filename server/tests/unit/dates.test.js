import { describe, expect, it } from 'vitest';
import {
  addDays,
  isLocalDate,
  startOfLocalDay,
  timeZoneOffsetMinutes,
  toInstant,
} from '../../src/utils/dates.js';

describe('timeZoneOffsetMinutes', () => {
  it('knows India is 5h30 ahead of UTC all year', () => {
    expect(timeZoneOffsetMinutes(new Date('2026-01-15T00:00:00Z'), 'Asia/Kolkata')).toBe(330);
    expect(timeZoneOffsetMinutes(new Date('2026-07-15T00:00:00Z'), 'Asia/Kolkata')).toBe(330);
  });

  it('handles daylight saving time', () => {
    expect(timeZoneOffsetMinutes(new Date('2026-01-15T12:00:00Z'), 'Europe/London')).toBe(0);
    expect(timeZoneOffsetMinutes(new Date('2026-07-15T12:00:00Z'), 'Europe/London')).toBe(60);
  });
});

describe('startOfLocalDay', () => {
  it('returns midnight in the given zone', () => {
    expect(startOfLocalDay('2026-09-24', 'Asia/Kolkata').toISOString()).toBe(
      '2026-09-23T18:30:00.000Z',
    );
    expect(startOfLocalDay('2026-09-24', 'UTC').toISOString()).toBe('2026-09-24T00:00:00.000Z');
    expect(startOfLocalDay('2026-07-01', 'America/New_York').toISOString()).toBe(
      '2026-07-01T04:00:00.000Z',
    );
  });

  it('is correct on a daylight-saving switch day', () => {
    // UK clocks go forward on 29 March 2026; midnight is still GMT.
    expect(startOfLocalDay('2026-03-29', 'Europe/London').toISOString()).toBe(
      '2026-03-29T00:00:00.000Z',
    );
    expect(startOfLocalDay('2026-03-30', 'Europe/London').toISOString()).toBe(
      '2026-03-29T23:00:00.000Z',
    );
  });
});

describe('addDays', () => {
  it('rolls over months and years', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('toInstant', () => {
  it('turns a local date into the start of that day', () => {
    expect(toInstant('2026-09-24', 'Asia/Kolkata').toISOString()).toBe('2026-09-23T18:30:00.000Z');
  });

  it('keeps a full timestamp as it is', () => {
    expect(toInstant('2026-09-24T13:45:00+05:30', 'UTC').toISOString()).toBe(
      '2026-09-24T08:15:00.000Z',
    );
  });

  it('recognises local dates', () => {
    expect(isLocalDate('2026-09-24')).toBe(true);
    expect(isLocalDate('2026-09-24T10:00:00Z')).toBe(false);
  });
});
