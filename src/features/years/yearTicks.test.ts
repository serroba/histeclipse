import { describe, expect, it } from 'vitest';

import { yearTicks } from './yearTicks';

const ma = (year: number): number => (1950 - year) / 1e6;

describe('the Years bar’s round marks', () => {
  it('marks the years at round historical years, with no year 0', () => {
    const ticks = yearTicks(ma(-9699), ma(2026));
    // Every other millennium, clear of the ends, where 9700 BCE and this year are named.
    expect(ticks.map(({ label }) => label)).toEqual(['6000 BCE', '4000 BCE', '2000 BCE']);
    for (const { label } of ticks) expect(label).not.toMatch(/^0 /);
    // 2000 BCE is astronomical year −1999.
    const twoThousand = ticks.find(({ label }) => label === '2000 BCE');
    expect(twoThousand?.ma).toBeCloseTo((1950 + 1999) / 1e6, 9);
  });

  it('marks a narrower window by its own round years, without the CE (#749)', () => {
    expect(yearTicks(ma(1854), ma(2026)).map(({ label }) => label)).toEqual(['1900', '1950']);
  });
});
