import { describe, expect, it } from 'vitest';

import { css, PALETTE } from './palette';
import { seeded } from './seeded';
import { clamp01, ease, within } from './timing';

describe('the palette', () => {
  it('writes colours as CSS does', () => {
    expect(css(PALETTE.nitrogen)).toBe('#5a99ff');
    expect(css(PALETTE.night)).toBe('#02040a');
  });
});

describe('timing', () => {
  it('eases from 0 to 1, slow at both ends, through the middle at a half', () => {
    expect(ease(0)).toBe(0);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(1)).toBe(1);
    expect(ease(0.1)).toBeLessThan(0.1);
    expect(ease(0.9)).toBeGreaterThan(0.9);
  });

  it('holds between 0 and 1, and says how far through a span a moment is', () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(0.3)).toBe(0.3);
    expect(clamp01(4)).toBe(1);
    expect(within(1500, 1000, 2000)).toBe(0.5);
    expect(within(500, 1000, 2000)).toBe(0);
    expect(within(2500, 1000, 2000)).toBe(1);
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
