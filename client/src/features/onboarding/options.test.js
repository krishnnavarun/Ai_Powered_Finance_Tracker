import { describe, expect, it } from 'vitest';
import { timeZoneOptions } from './options';

describe('timeZoneOptions', () => {
  it('puts the given zones first and never repeats one', () => {
    const options = timeZoneOptions('Europe/Paris', 'Asia/Kolkata', undefined);
    expect(options.slice(0, 2)).toEqual(['Europe/Paris', 'Asia/Kolkata']);
    expect(options.filter((zone) => zone === 'Asia/Kolkata')).toHaveLength(1);
  });
});
