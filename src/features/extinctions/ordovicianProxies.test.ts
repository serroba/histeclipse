import { describe, expect, it } from 'vitest';

import { ORDOVICIAN_CARBON_ISOTOPES, ORDOVICIAN_TEMPERATURES } from './ordovicianProxies';

const MYR = 1e6 * 365.25 * 86_400;
/** The Hirnantian on the clock: from its first pulse to the Silurian, 1.4 Myr on. */
const inHirnantian = (seconds: number) => seconds > 0 && seconds < 1.4 * MYR;

describe('the end-Ordovician’s tropical sea, measured (#1229)', () => {
  it('keeps Finnegan et al.’s 38 unaltered samples from a million years before to ten after', () => {
    for (const chart of [ORDOVICIAN_TEMPERATURES, ORDOVICIAN_CARBON_ISOTOPES]) {
      expect(chart.readings).toHaveLength(38);
      for (const each of chart.readings) {
        expect(each.seconds).toBeGreaterThanOrEqual(-1 * MYR);
        expect(each.seconds).toBeLessThanOrEqual(10 * MYR);
        expect(each.value).toBeGreaterThan(chart.low);
        expect(each.value).toBeLessThan(chart.high);
      }
    }
  });

  it('has its coolest, 28–31 °C, only in the Hirnantian', () => {
    const cool = ORDOVICIAN_TEMPERATURES.readings.filter((each) => each.value < 32);
    expect(cool.length).toBeGreaterThan(0);
    expect(cool.every((each) => inHirnantian(each.seconds))).toBe(true);
    expect(Math.min(...cool.map((each) => each.value))).toBe(28.4);
  });

  it('has its heaviest carbon, above +3‰, in the Hirnantian', () => {
    const heavy = ORDOVICIAN_CARBON_ISOTOPES.readings.filter((each) => each.value > 3);
    expect(heavy.length).toBeGreaterThan(0);
    expect(heavy.every((each) => inHirnantian(each.seconds))).toBe(true);
  });

  it('says whose, and that the dating is rough', () => {
    expect(ORDOVICIAN_TEMPERATURES.says).toMatch(/Finnegan et al\. 2011/);
    expect(ORDOVICIAN_CARBON_ISOTOPES.says).toMatch(/only roughly on this clock/);
  });
});
