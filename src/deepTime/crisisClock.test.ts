import { describe, expect, it } from 'vitest';

import { CRISIS_SCALE, LONG_CRISIS_SCALE } from './crisisClock';

const YEAR = 365.25 * 86_400;
const KYR = 1000 * YEAR;
const { secondsAt, positionAt, advance, text, end } = CRISIS_SCALE;

describe('the crisis clock (#1191)', () => {
  it('runs from 400,000 years before the extinction to 10 million after', () => {
    expect(secondsAt(0)).toBeCloseTo(-400 * KYR, -3);
    expect(secondsAt(end)).toBeCloseTo(10_000 * KYR, -6);
    expect(secondsAt(-1)).toBe(secondsAt(0));
    expect(secondsAt(end + 1)).toBe(secondsAt(end));
  });

  it('is linear across the crisis, 100,000 years a unit, then two units a tenfold', () => {
    expect(positionAt(0)).toBeCloseTo(4);
    expect(positionAt(-300 * KYR)).toBeCloseTo(1);
    expect(positionAt(200 * KYR)).toBeCloseTo(6);
    expect(positionAt(2000 * KYR)).toBeCloseTo(8);
    expect(positionAt(-1e9 * KYR)).toBe(0);
    expect(positionAt(1e9 * KYR)).toBe(end);
  });

  it('finds again the moment at each position, on both spans', () => {
    for (const position of [0, 1.5, 4, 5.9, 6, 7.3, end]) {
      expect(positionAt(secondsAt(position))).toBeCloseTo(position, 9);
    }
  });

  it('plays slower to faster with the pace, and at half pace across the extinction', () => {
    expect(advance('slow', 1, 0)).toBeLessThan(advance('normal', 1, 0));
    expect(advance('normal', 1, 0)).toBeLessThan(advance('fast', 1, 0));
    expect(advance('normal', 1, positionAt(10 * KYR))).toBeCloseTo(advance('normal', 1, 0) / 2);
    expect(advance('normal', 1, positionAt(150 * KYR))).toBe(advance('normal', 1, 0));
  });

  it('plays the whole in about a minute and a half at Slow', () => {
    let played = 0;
    for (let at = 0; at < end; played += 0.01) at += advance('slow', 0.01, at);
    expect(played).toBeGreaterThan(80);
    expect(played).toBeLessThan(120);
  });

  it('says how long before or after the extinction began', () => {
    expect(text(0)).toBe('The extinction begins');
    expect(text(-300 * KYR)).toBe('300 thousand years before the extinction');
    expect(text(61 * KYR)).toBe('61 thousand years after the extinction began');
    expect(text(2500 * KYR)).toBe('2.5 million years after the extinction began');
  });

  it('marks the lavas, the extinction and the tail, in order along the slider', () => {
    const at = CRISIS_SCALE.marks.map(([seconds]) => positionAt(seconds));
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(at.at(-1)).toBeCloseTo(end);
  });
});

describe('the long crisis clock (#1202)', () => {
  const long = LONG_CRISIS_SCALE;
  it('runs from a million years before to ten million after, 250,000 years a unit across', () => {
    expect(long.secondsAt(0)).toBeCloseTo(-1000 * KYR, -3);
    expect(long.positionAt(0)).toBeCloseTo(4);
    expect(long.positionAt(2000 * KYR)).toBeCloseTo(12);
    expect(long.secondsAt(long.end)).toBeCloseTo(10_000 * KYR, -6);
  });

  it('plays at one pace throughout, the whole in about a minute and a half at Slow', () => {
    expect(long.advance('slow', 1, long.positionAt(0))).toBe(long.advance('slow', 1, 0));
    let played = 0;
    for (let at = 0; at < long.end; played += 0.01) at += long.advance('slow', 0.01, at);
    expect(played).toBeGreaterThan(80);
    expect(played).toBeLessThan(120);
  });
});
