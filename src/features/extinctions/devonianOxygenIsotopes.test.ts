import { describe, expect, it } from 'vitest';

import { DEVONIAN_OXYGEN_ISOTOPES } from './devonianOxygenIsotopes';

const MYR = 1e6 * 365.25 * 86_400;
const mean = (values: number[]) => values.reduce((sum, each) => sum + each, 0) / values.length;

describe('the Late Devonian’s conodonts, measured (#1229)', () => {
  const readings = DEVONIAN_OXYGEN_ISOTOPES.readings;
  const between = (from: number, to: number) =>
    readings
      .filter((each) => each.seconds >= from * MYR && each.seconds < to * MYR)
      .map((each) => each.value);

  it('keeps Joachimski et al.’s 179 samples from a million years before to ten after', () => {
    expect(readings).toHaveLength(179);
    for (const each of readings) {
      expect(each.seconds).toBeGreaterThanOrEqual(-1 * MYR);
      expect(each.seconds).toBeLessThanOrEqual(10 * MYR);
      expect(each.value).toBeGreaterThan(DEVONIAN_OXYGEN_ISOTOPES.low);
      expect(each.value).toBeLessThan(DEVONIAN_OXYGEN_ISOTOPES.high);
    }
  });

  it('is heavier, cooler, just after the upper Kellwasser than before the lower', () => {
    expect(mean(between(0.6, 1.1))).toBeGreaterThan(mean(between(-0.5, 0)) + 0.3);
  });

  it('says whose, and how it is placed on the clock', () => {
    expect(DEVONIAN_OXYGEN_ISOTOPES.says).toMatch(/Joachimski et al\. \(2009\)/);
    expect(DEVONIAN_OXYGEN_ISOTOPES.says).toMatch(/Joachimski & Buggisch \(2002\)/);
  });
});
