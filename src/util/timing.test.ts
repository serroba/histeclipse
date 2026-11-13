import { describe, expect, it } from 'vitest';
import { clamp01, ease, easeOut, through, within } from './timing';

describe('timing', () => {
  it('eases in and out, symmetric about the middle', () => {
    expect(ease(0)).toBe(0);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(1)).toBe(1);
    expect(ease(0.1)).toBeLessThan(0.1);
    expect(ease(0.9)).toBeGreaterThan(0.9);
    expect(ease(0.25)).toBeCloseTo(1 - ease(0.75));
  });

  it('eases out: past the straight line, settling at the end', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBe(0.875);
  });

  it('clamps to 0..1', () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(0.3)).toBe(0.3);
    expect(clamp01(4)).toBe(1);
  });

  it('says how far through a span a moment is, by its end or its length', () => {
    expect(within(150, 100, 300)).toBe(0.25);
    expect(through(150, 100, 200)).toBe(0.25);
    expect(within(50, 100, 300)).toBe(0);
    expect(through(400, 100, 200)).toBe(1);
  });
});
