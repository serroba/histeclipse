import { describe, expect, it } from 'vitest';

import { MEISHAN_TEMPERATURES, sampleAges, temperatureOf } from './meishanTemperatures';

const KYR = 1000 * 365.25 * 86_400;

describe('the sea’s warming at Meishan (#1229)', () => {
  it('works temperature out as the paper does, to its table’s rounding', () => {
    // Table DR1: 22.0‰ is 21.6 °C, 18.8‰ is 35.1 °C, 20.7‰ is 27.1 °C.
    expect(temperatureOf(22.0)).toBeCloseTo(21.6, 1);
    expect(temperatureOf(18.8)).toBeCloseTo(35.1, 1);
    expect(temperatureOf(20.7)).toBeCloseTo(27.1, 1);
  });

  it('dates samples at their dated level, or evenly between the levels round them', () => {
    const ages = sampleAges([
      { ma: 10 },
      { bed: 'a', d18o: [20, null, null] },
      { bed: 'b', d18o: [20, null, null] },
      { bed: 'c', d18o: [20, null, null], ma: 7 },
    ]);
    expect(ages).toEqual([9, 8, 7]);
    expect(() => sampleAges([{ bed: 'x', d18o: [20, null, null] }])).toThrow('undated: x');
  });

  it('keeps every reading the table gives a temperature for, and the warmest after bed 28', () => {
    // 41 readings dated between beds, and the one above bed 28 across its span.
    expect(MEISHAN_TEMPERATURES.readings).toHaveLength(42);
    const last = MEISHAN_TEMPERATURES.readings.at(-1);
    expect(last?.value).toBeCloseTo(35.1, 1);
    expect(last?.between?.[0]).toBeCloseTo(61 * KYR, -10);
  });

  it('warms by some 8 °C in Hindeodus from before the extinction to its end', () => {
    const hindeodus = MEISHAN_TEMPERATURES.readings.filter((each) => each.series === 1);
    const before = hindeodus.filter((each) => each.seconds < 0).map((each) => each.value);
    const after = hindeodus.filter((each) => each.seconds > 0).map((each) => each.value);
    expect(Math.max(...after) - Math.min(...before)).toBeGreaterThan(8);
  });
});
