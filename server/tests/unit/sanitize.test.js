import { describe, expect, it } from 'vitest';
import { sanitize } from '../../src/middleware/sanitize.js';

describe('sanitize', () => {
  it('removes MongoDB operator keys', () => {
    expect(sanitize({ email: { $gt: '' }, password: 'x' })).toEqual({ email: {}, password: 'x' });
  });

  it('removes dotted keys', () => {
    expect(sanitize({ 'settings.aiEnabled': false, name: 'Asha' })).toEqual({ name: 'Asha' });
  });

  it('removes prototype-pollution keys', () => {
    const input = JSON.parse('{"__proto__": {"isAdmin": true}, "constructor": 1, "ok": 1}');
    const result = sanitize(input);
    expect(result).toEqual({ ok: 1 });
    expect({}.isAdmin).toBeUndefined();
  });

  it('cleans nested objects and arrays', () => {
    expect(
      sanitize({ tags: [{ $where: 'sleep(1000)' }, 'food'], a: { b: { $ne: 1, c: 2 } } }),
    ).toEqual({ tags: [{}, 'food'], a: { b: { c: 2 } } });
  });

  it('leaves primitives and safe objects unchanged', () => {
    expect(sanitize('₹250')).toBe('₹250');
    expect(sanitize(25050)).toBe(25050);
    expect(sanitize(null)).toBeNull();
    expect(sanitize({ amount: 25050, note: 'biryani' })).toEqual({
      amount: 25050,
      note: 'biryani',
    });
  });
});
