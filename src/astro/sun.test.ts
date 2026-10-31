import { describe, expect, it } from 'vitest';

import reference from '../../test-vectors/sun.json';
import { julianDayNumber } from '../time/julianDay';
import {
  greenwichApparentSiderealTime,
  greenwichMeanSiderealTime,
  subsolarPoint,
  sunPosition,
} from './sun';

const vectors = reference.vectors.map((vector) => ({
  ...vector,
  ut: julianDayNumber(vector.jdUT),
  tt: julianDayNumber(vector.jdTT),
  year: 2000 + (vector.jdUT - 2_451_545) / 365.25,
}));

function angleDifference(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/** Largest error of `measure` over vectors whose year lies in [from, to). */
function worst(from: number, to: number, measure: (v: (typeof vectors)[number]) => number): number {
  return Math.max(...vectors.filter((v) => v.year >= from && v.year < to).map(measure));
}

describe('against JPL DE441 (test-vectors/sun.json)', () => {
  it('covers 4000 BCE to 3000 CE', () => {
    expect(vectors).toHaveLength(200);
    expect(vectors[0]?.year).toBeLessThan(-3990);
    expect(vectors.at(-1)?.year).toBeGreaterThan(2999);
  });

  const errors = (v: (typeof vectors)[number]) => {
    const point = subsolarPoint(v.ut, v.tt);
    return {
      latitude: Math.abs(point.latitude - v.subsolarLatitude),
      longitude: angleDifference(point.longitude, v.subsolarLongitude),
      gmst: angleDifference(greenwichMeanSiderealTime(v.ut), v.gmstHours * 15),
      gast: angleDifference(greenwichApparentSiderealTime(v.ut, v.tt), v.gastHours * 15),
    };
  };

  it.each<[number, number, number]>([
    // [from year, to year, max error in degrees]. Measured worst cases: 0.008° since
    // 1000 BCE, 0.022° at 4000 BCE. 0.01° of longitude is about 1 km at the equator.
    [-1000, 3001, 0.01],
    [-4000, -1000, 0.03],
  ])('places the subsolar point within tolerance for %i to %i', (from, to, tolerance) => {
    expect(worst(from, to, (v) => errors(v).latitude)).toBeLessThan(tolerance);
    expect(worst(from, to, (v) => errors(v).longitude)).toBeLessThan(tolerance);
  });

  it('matches sidereal time where the precession models agree', () => {
    // Meeus uses the IAU 1976 precession, Skyfield IAU 2006; they part ways before 1000 BCE
    // (0.1° by 4000 BCE). The subsolar point is unaffected because the Sun's right ascension
    // carries the same precession, so the difference cancels, as the test above shows.
    expect(worst(-1000, 3001, (v) => errors(v).gmst)).toBeLessThan(0.01);
    expect(worst(-1000, 3001, (v) => errors(v).gast)).toBeLessThan(0.01);
  });
});

describe('sunPosition', () => {
  it('reproduces Meeus example 25.a (1992 October 13.0 TD)', () => {
    const sun = sunPosition(julianDayNumber(2_448_908.5));
    // Apparent RA 13h13m31.4s = 198.38083°, declination −7°47′06″ = −7.78507°.
    expect(sun.rightAscension).toBeCloseTo(198.38083, 2);
    expect(sun.declination).toBeCloseTo(-7.78507, 2);
  });
});

describe('greenwichMeanSiderealTime', () => {
  it('reproduces Meeus example 12.b (1987 April 10, 19:21 UT)', () => {
    // 8h34m57.0896s = 128.73787°.
    expect(greenwichMeanSiderealTime(julianDayNumber(2_446_896.30625))).toBeCloseTo(128.73787, 3);
  });
});
