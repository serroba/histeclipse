import { describe, expect, it } from 'vitest';

import { julianDay, julianDayNumber } from '../time/julianDay';
import { astronomicalYear } from '../time/year';
import {
  lunarSix,
  nextCrossing,
  offsetBetween,
  starsByNumber,
  sunriseOn,
  sunsetOn,
} from './tabletSky';
import { testSky } from './testSky';

const RD_TO_JD = 1_721_424.5;
/** A Julian-calendar civil date as a fixed day; `year` astronomical. */
const day = (year: number, month: number, date: number) =>
  julianDay({ year: astronomicalYear(year), month, day: date, calendar: 'julian' }) - RD_TO_JD;
const REGULUS = { star: 3982 };
const BETA_LIBRAE = { star: 5685 };

// Reference values: the astro-tablets project's computation for VAT 4956 (J. Halsey, from
// Skyfield and DE ephemerides), for 568 BCE (−567). It names each Babylonian day by the evening
// that began it, so its mornings are the next civil date.
describe('the sky over Babylon in 568 BCE', () => {
  it('puts Venus about 1.5° above Regulus on the evening of 8 June', () => {
    const evening = julianDayNumber((sunsetOn(testSky, day(-567, 6, 8)) ?? Number.NaN) + 1 / 24);
    const { across } = offsetBetween(testSky, 'venus', REGULUS, evening);
    expect(across).toBeCloseTo(1.5, 0);
  });

  it('puts Mars about 7.4° in front of Regulus on the evening of 20 June', () => {
    const evening = julianDayNumber((sunsetOn(testSky, day(-567, 6, 20)) ?? Number.NaN) + 1 / 24);
    const { along } = offsetBetween(testSky, 'mars', REGULUS, evening);
    expect(along).toBeGreaterThan(-8.5);
    expect(along).toBeLessThan(-6.5);
  });

  it('puts the Moon about 4.5° below β Librae on the evening of 27 June', () => {
    const evening = julianDayNumber((sunsetOn(testSky, day(-567, 6, 27)) ?? Number.NaN) + 2 / 24);
    const { across } = offsetBetween(testSky, 'moon', BETA_LIBRAE, evening);
    expect(across).toBeGreaterThan(-5.5);
    expect(across).toBeLessThan(-3.5);
  });

  it('times the lunar six as astro-tablets does, to an UŠ or so', () => {
    // NA on the first evening of Simanu (20 June): 22.4; KUR the morning of 17 June: 22.7;
    // NA the morning of 6 May: 3.5.
    expect(lunarSix(testSky, 'NA first', day(-567, 6, 20))).toBeCloseTo(22.4, -0.5);
    expect(lunarSix(testSky, 'KUR', day(-567, 6, 17))).toBeCloseTo(22.7, -0.5);
    expect(lunarSix(testSky, 'NA', day(-567, 5, 6))).toBeCloseTo(3.5, -0.5);
  });

  it('times the intervals around full moon too', () => {
    // Full moon of Simanu, 568 BCE: about 4 July.
    for (const kind of ['SU', 'ME', 'GE6'] as const) {
      const values = [2, 3, 4, 5].map((date) => lunarSix(testSky, kind, day(-567, 7, date)));
      expect(values.some((value) => value !== null && value >= 0 && value < 60)).toBe(true);
    }
  });

  it('finds sunrise before sunset, and nothing that does not happen', () => {
    const date = day(-567, 6, 20);
    expect(sunriseOn(testSky, date) ?? 0).toBeLessThan(sunsetOn(testSky, date) ?? 0);
    expect(
      nextCrossing(
        testSky,
        'sun',
        'set',
        julianDayNumber((sunsetOn(testSky, date) ?? 0) + 0.01),
        0.2,
      ),
    ).toBeNull();
  });

  it('refuses a star missing from the catalogue', () => {
    expect(() =>
      offsetBetween(
        testSky,
        'moon',
        { star: 99_999 },
        julianDayNumber(day(-567, 6, 20) + RD_TO_JD),
      ),
    ).toThrow('No star HR 99999');
    expect(
      starsByNumber({
        hr: [],
        ra: [],
        dec: [],
        pmRa: [],
        pmDec: [],
        parallax: [],
        radialVelocity: [],
      }).size,
    ).toBe(0);
  });
});
