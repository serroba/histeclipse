import { describe, expect, it } from 'vitest';

import { KPG_TEMPERATURES } from './kpgTemperatures';

const KYR = 1000 * 365.25 * 86_400;

describe('the temperature after the K-Pg impact (#1229)', () => {
  const readings = KPG_TEMPERATURES.readings;
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1] ?? 0;

  it('keeps Hull et al.’s 663 readings of the million years after, most from the deep sea', () => {
    expect(readings).toHaveLength(663);
    expect(readings.filter((each) => each.series === 0)).toHaveLength(543);
  });

  it('places them all after the strike and within the clock’s million years', () => {
    for (const each of readings) {
      expect(each.seconds).toBeGreaterThan(0);
      expect(each.seconds).toBeLessThanOrEqual(1000 * KYR);
    }
  });

  it('shows the deep sea warming: near none at first, about a degree by 600,000 years on', () => {
    const deep = readings.filter((each) => each.series === 0);
    const early = deep.filter((each) => each.seconds < 100 * KYR).map((each) => each.value);
    const late = deep
      .filter((each) => each.seconds > 500 * KYR && each.seconds < 700 * KYR)
      .map((each) => each.value);
    expect(Math.abs(median(early))).toBeLessThan(0.75);
    expect(median(late)).toBeGreaterThan(0.75);
  });

  it('says whose, and how each record is measured', () => {
    expect(KPG_TEMPERATURES.says).toMatch(/Hull et al\. \(2020\)/);
    expect(KPG_TEMPERATURES.series).toHaveLength(3);
  });
});
