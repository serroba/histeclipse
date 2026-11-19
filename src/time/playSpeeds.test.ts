import { describe, expect, it } from 'vitest';

import { byMonth, niceSpeed, speedAt, speedLabel, speedsFor } from './playSpeeds';

describe('the Years bar’s speeds (#915)', () => {
  it('Given a speed, Then rounded to read easily: months under a year, else 1, 2 or 5 × 10ⁿ', () => {
    expect([0.04, 0.1, 0.2, 0.3, 0.5, 0.9].map((each) => niceSpeed(each) * 12)).toEqual([
      1, 1, 2, 3, 6, 6,
    ]);
    expect([1.43, 2.6, 5.7, 17, 98, 391, 1172, 8000].map(niceSpeed)).toEqual([
      1, 2, 5, 20, 100, 500, 1000, 10000,
    ]);
  });

  it('Given speeds, Then in words', () => {
    expect([1 / 12, 0.5, 1, 1000].map(speedLabel)).toEqual([
      '1 month/s',
      '6 months/s',
      '1 yr/s',
      '1,000 yr/s',
    ]);
  });

  it('Given a window, Then slow, medium and fast in about a quarter-hour, two minutes and twenty seconds', () => {
    expect(speedsFor(172).map(({ label }) => label)).toEqual(['2 months/s', '1 yr/s', '10 yr/s']);
    expect(speedsFor(11725).map(({ label }) => label)).toEqual(['10 yr/s', '100 yr/s', '500 yr/s']);
    expect(speedsFor(100).map(({ label }) => label)).toEqual(['1 month/s', '6 months/s', '5 yr/s']);
  });

  it('Given levels that fall together, Then one speed, and a level gone takes the slower', () => {
    // Ten years: slow and medium both round to a month a second.
    expect(speedsFor(10).map(({ level }) => level)).toEqual(['slow', 'fast']);
    expect(speedAt(10, 'medium').level).toBe('slow');
    expect(speedAt(10, 'fast').yearsPerSecond).toBeCloseTo(0.5);
    expect(speedAt(0, 'slow').label).toBe('1 month/s');
  });

  it('Given a speed, Then month by month up to a year a second', () => {
    expect([1 / 12, 0.5, 1, 2, 20].map(byMonth)).toEqual([true, true, true, false, false]);
  });
});
