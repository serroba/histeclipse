import { describe, expect, it } from 'vitest';

import { PERMIAN_CARBON_ISOTOPES } from './permianCarbonIsotopes';

const KYR = 1000 * 365.25 * 86_400;

describe('the sea’s carbon isotopes through the end-Permian extinction (#1229)', () => {
  const readings = PERMIAN_CARBON_ISOTOPES.readings;
  const meishan = readings.filter((each) => each.series === 0);

  it('keeps all 707 measurements of Cui et al.’s Dataset S02, 199 of them at Meishan', () => {
    expect(readings).toHaveLength(707);
    expect(meishan).toHaveLength(199);
  });

  it('draws Meishan last, over the other sections', () => {
    expect(readings.slice(-199).every((each) => each.series === 0)).toBe(true);
  });

  it('falls at Meishan from about +3‰ to its lowest, −3.96‰, at the extinction’s start', () => {
    const before = meishan.filter((each) => each.seconds < -25 * KYR && each.seconds > -60 * KYR);
    const lowest = meishan.reduce((low, each) => (each.value < low.value ? each : low));
    expect(Math.min(...before.map((each) => each.value))).toBeGreaterThan(2.5);
    expect(lowest.value).toBe(-3.96);
    expect(Math.abs(lowest.seconds)).toBeLessThan(1 * KYR);
  });

  it('stays within its chart and its clock, 400,000 years before to a million after', () => {
    for (const each of readings) {
      expect(each.value).toBeGreaterThan(PERMIAN_CARBON_ISOTOPES.low);
      expect(each.value).toBeLessThan(PERMIAN_CARBON_ISOTOPES.high);
      expect(each.seconds).toBeGreaterThan(-400 * KYR);
      expect(each.seconds).toBeLessThan(1000 * KYR);
    }
  });
});
