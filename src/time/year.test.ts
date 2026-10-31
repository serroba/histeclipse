import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  astronomicalYear,
  formatYear,
  toAstronomicalYear,
  toHistoricalYear,
  type HistoricalYear,
} from './year';

const historicalYear: fc.Arbitrary<HistoricalYear> = fc.record({
  year: fc.integer({ min: 1, max: 1_000_000 }),
  era: fc.constantFrom('BCE' as const, 'CE' as const),
});

describe('astronomicalYear', () => {
  it.each([0, -586, 2026])('accepts the integer %i', (value) => {
    expect(astronomicalYear(value)).toBe(value);
  });

  it.each([0.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])('rejects %d', (value) => {
    expect(() => astronomicalYear(value)).toThrow(RangeError);
  });
});

describe('toAstronomicalYear', () => {
  it.each<[HistoricalYear, number]>([
    [{ year: 1, era: 'CE' }, 1],
    [{ year: 1, era: 'BCE' }, 0],
    [{ year: 2, era: 'BCE' }, -1],
    [{ year: 587, era: 'BCE' }, -586],
    [{ year: 2026, era: 'CE' }, 2026],
  ])('maps %o to %i', (historical, expected) => {
    expect(toAstronomicalYear(historical)).toBe(expected);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects historical year %d', (year) => {
    expect(() => toAstronomicalYear({ year, era: 'CE' })).toThrow(RangeError);
  });
});

describe('toHistoricalYear', () => {
  it('has no year zero', () => {
    expect(toHistoricalYear(astronomicalYear(0))).toEqual({ year: 1, era: 'BCE' });
    expect(toHistoricalYear(astronomicalYear(1))).toEqual({ year: 1, era: 'CE' });
  });

  it('round-trips through the astronomical scale', () => {
    fc.assert(
      fc.property(historicalYear, (historical) => {
        expect(toHistoricalYear(toAstronomicalYear(historical))).toEqual(historical);
      }),
    );
  });

  it('round-trips from the astronomical scale', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000, max: 1_000_000 }), (value) => {
        const year = astronomicalYear(value);
        expect(toAstronomicalYear(toHistoricalYear(year))).toBe(year);
      }),
    );
  });

  it('is strictly increasing across the BCE/CE boundary', () => {
    fc.assert(
      fc.property(historicalYear, historicalYear, (a, b) => {
        const signed = (h: HistoricalYear): number => (h.era === 'CE' ? h.year : -h.year);
        fc.pre(signed(a) < signed(b));
        expect(toAstronomicalYear(a)).toBeLessThan(toAstronomicalYear(b));
      }),
    );
  });
});

describe('formatYear', () => {
  it.each([
    [-586, '587 BCE'],
    [0, '1 BCE'],
    [1, '1 CE'],
    [2026, '2026 CE'],
  ])('formats %i as %s', (value, expected) => {
    expect(formatYear(astronomicalYear(value))).toBe(expected);
  });
});
