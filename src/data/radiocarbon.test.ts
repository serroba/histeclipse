import { describe, expect, it } from 'vitest';

import data from '../../public/data/radiocarbon.json';
import {
  calibrate,
  chartWindow,
  fractionLeft,
  highestDensity,
  loadRadiocarbon,
  rangeText,
  yearOfCalBP,
  type CalibrationCurve,
  type Radiocarbon,
} from './radiocarbon';

const real = data as Radiocarbon;
const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

/** A made-up curve, a row a year from `from` to `to` cal BP, its age given by `ageAt`. */
function curve(from: number, to: number, ageAt: (calBP: number) => number): CalibrationCurve {
  const calBP = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return {
    cite: 'test',
    doi: 'test',
    calBP,
    age: calBP.map(ageAt),
    sigma: calBP.map(() => 0),
    delta: calBP.map(() => 0),
    deltaSigma: calBP.map(() => 0),
  };
}

describe('the calibration curves', () => {
  it('load and check, the real file too', async () => {
    await expect(loadRadiocarbon('/r.json', serve(real))).resolves.toEqual(real);
    const shuffled = {
      ...real,
      curves: { ...real.curves, intcal20: { ...real.curves.intcal20, calBP: [5, 1, 2] } },
    };
    await expect(loadRadiocarbon('/r.json', serve(shuffled))).rejects.toThrow();
  });

  it('reach 55,000 years back, north and south', () => {
    expect(real.curves.intcal20.calBP.at(-1)).toBe(55_000);
    expect(real.curves.shcal20.calBP.at(-1)).toBe(55_000);
    expect(real.curves.intcal20.calBP[0]).toBe(0);
  });

  it('turn years before 1950 into calendar years', () => {
    expect(yearOfCalBP(0)).toBe(1950);
    expect(yearOfCalBP(1950)).toBe(0);
    // No year zero: 1950 BP is 1 BCE, so 2765 BP is 816 BCE.
    expect(rangeText({ older: 2765, younger: 2720, share: 1 })).toBe('816–771 BCE');
    expect(rangeText({ older: 931, younger: 795, share: 1 })).toBe('1019–1155 CE');
    expect(rangeText({ older: 1960, younger: 1940, share: 1 })).toBe('11 BCE–10 CE');
  });
});

describe('calibrating', () => {
  it('on a straight curve, gives the measured age ± 2σ, as one range', () => {
    const ranges = highestDensity(
      calibrate(
        1000,
        20,
        curve(800, 1200, (t) => t),
      ),
    );
    expect(ranges).toHaveLength(1);
    const [only] = ranges;
    expect(only?.older).toBeGreaterThanOrEqual(1038);
    expect(only?.older).toBeLessThanOrEqual(1041);
    expect(only?.younger).toBeGreaterThanOrEqual(959);
    expect(only?.younger).toBeLessThanOrEqual(962);
    expect(only?.share).toBeGreaterThan(0.95);
  });

  it('on a plateau, gives a long range: many years share one age', () => {
    // Flat at 2450 BP from 2400 to 2700 cal BP, steep either side.
    const plateau = curve(2000, 3100, (t) =>
      t < 2400 ? 2450 - (2400 - t) : t > 2700 ? 2450 + (t - 2700) : 2450,
    );
    const [only] = highestDensity(calibrate(2450, 25, plateau));
    expect((only?.older ?? 0) - (only?.younger ?? 0)).toBeGreaterThan(300);
  });

  it('where the curve wiggles back, gives two ranges', () => {
    // The age reaches 1000 BP twice: rising to 1050 by 1100 cal BP, back to 950, then up.
    const wiggle = curve(800, 1400, (t) =>
      t < 1100 ? 850 + ((t - 800) * 200) / 300 : t < 1200 ? 1050 - (t - 1100) : 950 + (t - 1200),
    );
    expect(highestDensity(calibrate(1000, 15, wiggle)).length).toBeGreaterThanOrEqual(2);
  });

  it('sums to one, and holds the level asked for', () => {
    const calibration = calibrate(3000, 30, real.curves.intcal20);
    const total = calibration.probability.reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(1, 9);
    const held = highestDensity(calibration).reduce((sum, { share }) => sum + share, 0);
    expect(held).toBeGreaterThanOrEqual(0.954);
    expect(held).toBeLessThan(0.97);
  });

  it('spreads an Iron Age age over the Hallstatt plateau, as the real curve has it', () => {
    const ranges = highestDensity(calibrate(2450, 25, real.curves.intcal20));
    const oldest = Math.max(...ranges.map(({ older }) => older));
    const youngest = Math.min(...ranges.map(({ younger }) => younger));
    // Centuries wide, from before 700 BCE to after 450 BCE.
    expect(yearOfCalBP(oldest)).toBeLessThan(-699);
    expect(yearOfCalBP(youngest)).toBeGreaterThan(-449);
  });
});

describe('for the card', () => {
  it('says how much carbon-14 is left: half after one Libby half-life', () => {
    expect(fractionLeft(0)).toBe(1);
    expect(fractionLeft(5568)).toBeCloseTo(0.5, 3);
    expect(fractionLeft(2450)).toBeCloseTo(0.737, 3);
  });

  it('frames a calibration with room either side', () => {
    const window = chartWindow([
      { older: 2750, younger: 2700, share: 0.3 },
      { older: 2650, younger: 2400, share: 0.65 },
    ]);
    expect(window.older).toBeGreaterThan(2750);
    expect(window.younger).toBeLessThan(2400);
    expect(chartWindow([{ older: 30, younger: 10, share: 1 }]).younger).toBe(0);
  });
});
