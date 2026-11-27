import { describe, expect, it } from 'vitest';

import { PERMIAN_CARBON_DIOXIDE } from './permianCarbonDioxide';

const KYR = 1000 * 365.25 * 86_400;

describe('carbon dioxide through the end-Permian extinction (#1229)', () => {
  const readings = PERMIAN_CARBON_DIOXIDE.readings;

  it('keeps Wu et al.’s curve every 10,000 years, from 252.104 to 251.4 Ma', () => {
    expect(readings).toHaveLength(72);
    expect(readings[0]?.seconds).toBeCloseTo(-163 * KYR, -10);
    expect(readings.at(-1)?.seconds).toBeCloseTo(541 * KYR, -10);
  });

  it('rises some sixfold, from about 430 ppm to its peak of 2,507, 47,000 years in', () => {
    const peak = readings.reduce((top, each) => (each.value > top.value ? each : top));
    expect(peak.value).toBe(2507);
    expect(peak.seconds).toBeCloseTo(47 * KYR, -10);
    expect(peak.value / (readings[0]?.value ?? 1)).toBeCloseTo(5.9, 1);
  });

  it('stays within its chart', () => {
    for (const each of readings) {
      expect(each.value).toBeGreaterThan(PERMIAN_CARBON_DIOXIDE.low);
      expect(each.value).toBeLessThan(PERMIAN_CARBON_DIOXIDE.high);
    }
  });
});
