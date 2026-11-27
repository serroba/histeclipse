import { describe, expect, it } from 'vitest';

import { CAMP_CARBON_DIOXIDE, secondsOf } from './campCarbonDioxide';

const KYR = 1000 * 365.25 * 86_400;

describe('carbon dioxide through the end-Triassic’s eruptions (#1229)', () => {
  it('puts the basin’s first lava 44,000 years after the extinction began', () => {
    // 201.564 Ma, the extinction; 201.52 Ma, the Orange Mountain Basalt's base.
    expect(secondsOf(0)).toBeCloseTo(44 * KYR, -10);
  });

  it('keeps table S1’s samples from 400,000 years before the extinction on', () => {
    expect(CAMP_CARBON_DIOXIDE.readings).toHaveLength(24);
    for (const reading of CAMP_CARBON_DIOXIDE.readings) {
      expect(reading.seconds).toBeGreaterThan(-400 * KYR);
    }
  });

  it('rises from below the first lava to just after it, as the paper says', () => {
    const below = CAMP_CARBON_DIOXIDE.readings.filter((each) => each.series === 0);
    const above = CAMP_CARBON_DIOXIDE.readings.filter((each) => each.series === 1);
    expect(below.at(-1)?.value).toBe(1065);
    expect(above[0]?.value).toBe(4434);
    expect(Math.max(...below.map((each) => each.value))).toBeLessThan(2300);
  });
});
