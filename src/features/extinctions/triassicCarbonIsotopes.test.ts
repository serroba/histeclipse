import { describe, expect, it } from 'vitest';

import { placed, TRIASSIC_CARBON_ISOTOPES } from './triassicCarbonIsotopes';

const KYR = 1000 * 365.25 * 86_400;
const [NEWARK, HOUNSLOW, WEEDON] = TRIASSIC_CARBON_ISOTOPES;

describe('St Audrie’s Bay’s carbon isotopes, three ways in time (#1229)', () => {
  it('interpolates between tie points, and places nothing outside them', () => {
    const ties = [
      [10, 0],
      [20, 100],
    ] as const;
    expect(placed(ties, 15)).toBe(50);
    expect(placed(ties, 9)).toBeNull();
    expect(placed(ties, 21)).toBeNull();
  });

  it('places as many samples as each model’s sources can, none above 28 m', () => {
    expect(NEWARK?.readings).toHaveLength(71);
    expect(HOUNSLOW?.readings.length).toBeGreaterThan(71);
    expect(WEEDON?.readings.length).toBeLessThan(71);
  });

  it('starts the Newark model at the sharp drop, the extinction, light carbon from it on', () => {
    const first = NEWARK?.readings[0];
    expect(first?.seconds).toBeGreaterThan(0);
    expect(first?.seconds).toBeLessThan(5 * KYR);
    expect(first?.value).toBeLessThan(-28);
  });

  it('stretches the same rocks farther with each model: the top of the Planorbis Zone', () => {
    const last = (chart: typeof NEWARK) => chart?.readings.at(-1)?.seconds ?? 0;
    expect(last(NEWARK)).toBeLessThan(last(HOUNSLOW));
    expect(last(HOUNSLOW)).toBeLessThan(last(WEEDON));
  });

  it('says each is assembled for this site, and whose its tie points are', () => {
    for (const chart of TRIASSIC_CARBON_ISOTOPES) {
      expect(chart.says).toMatch(/assembled for this site/);
      expect(
        chart.readings.every((each) => each.value > chart.low && each.value < chart.high),
      ).toBe(true);
    }
    expect(NEWARK?.says).toMatch(/Kent et al\. 2017/);
    expect(HOUNSLOW?.says).toMatch(/Hounslow & Andrews 2024/);
    expect(WEEDON?.says).toMatch(/Weedon et al\.’s \(2018\)/);
  });
});
