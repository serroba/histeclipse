import { describe, expect, it } from 'vitest';

import { css, PALETTE } from './palette';
import { seeded } from './seeded';

describe('the palette', () => {
  it('writes colours as CSS does', () => {
    expect(css(PALETTE.nitrogen)).toBe('#5a99ff');
    expect(css(PALETTE.night)).toBe('#02040a');
  });
});

describe('seeded', () => {
  it('gives the same numbers for the same seed, each from 0 to 1', () => {
    const a = seeded(11);
    const b = seeded(11);
    const numbers = Array.from({ length: 50 }, a);
    expect(Array.from({ length: 50 }, b)).toEqual(numbers);
    for (const n of numbers) {
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThan(1);
    }
    expect(seeded(12)()).not.toBe(numbers[0]);
  });
});
