import { Equatorial } from 'astronomia/coord';
import { position as precess } from 'astronomia/precess';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { geoToVector } from '../globe/geo';
import { julianDayNumber } from '../time/julianDay';
import {
  apply,
  directionFromRaDec,
  IDENTITY,
  multiply,
  raDecFromVector,
  transpose,
  type Vector3,
} from './matrix';
import { earthFixedToJ2000, precessionMatrix, sunPositionJ2000 } from './precession';
import { subsolarPoint, sunDistance } from './sun';

const ARCSECOND = Math.PI / 180 / 3600;

function angle(a: Vector3, b: Vector3): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.min(1, dot / (Math.hypot(...a) * Math.hypot(...b))));
}

describe('precessionMatrix', () => {
  it('is the identity at J2000 and orthonormal elsewhere', () => {
    expect(precessionMatrix(julianDayNumber(2_451_545))).toEqual(IDENTITY);
    const m = precessionMatrix(julianDayNumber(1_000_000));
    multiply(m, transpose(m)).forEach((row, i) => {
      row.forEach((value, j) => {
        expect(value).toBeCloseTo(i === j ? 1 : 0, 12);
      });
    });
  });

  it('agrees with astronomia’s independent implementation of Meeus ch. 21', () => {
    // Stars at assorted positions, precessed from J2000 to epochs across the supported range.
    const cases = fc.sample(
      fc.record({
        ra: fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
        dec: fc.double({ min: -1.4, max: 1.4, noNaN: true }),
        year: fc.integer({ min: -4000, max: 3000 }),
      }),
      { numRuns: 60, seed: 42 },
    );
    for (const { ra, dec, year } of cases) {
      const jd = julianDayNumber(2_451_545 + (year - 2000) * 365.25);
      const ours = apply(precessionMatrix(jd), directionFromRaDec(ra, dec));
      const theirs = precess(new Equatorial(ra, dec), 2000, year, 0, 0);
      // The IAU 1976 series is the same; small differences come from how it is evaluated.
      expect(angle(ours, directionFromRaDec(theirs.ra, theirs.dec)) / ARCSECOND).toBeLessThan(1);
    }
  });
});

describe('earthFixedToJ2000', () => {
  it('points the subsolar point at the Sun', () => {
    // The place where the Sun is overhead, carried into the J2000 frame, must point at the Sun.
    for (const [ut, tt] of [
      [2_460_409.26, 2_460_409.2608],
      [1_494_714.6, 1_494_714.8173],
      [1_000_000.3, 1_000_000.8],
    ] as const) {
      const jdUT = julianDayNumber(ut);
      const jdTT = julianDayNumber(tt);
      const [x, y, z] = geoToVector(subsolarPoint(jdUT, jdTT));
      // geoToVector is in the scene's frame (y up); back to Earth-fixed x, y, z.
      const earthFixed: Vector3 = [x, -z, y];
      const sun = apply(earthFixedToJ2000(jdUT, jdTT), earthFixed);
      expect(angle(sun, sunPositionJ2000(jdTT)) / ARCSECOND).toBeLessThan(25);
    }
  });
});

describe('the Sun', () => {
  it('is nearest in early January and farthest in early July', () => {
    expect(sunDistance(julianDayNumber(2_460_679.5))).toBeCloseTo(0.98333, 3); // 2025 Jan 4
    expect(sunDistance(julianDayNumber(2_460_861.5))).toBeCloseTo(1.01664, 3); // 2025 Jul 4
  });

  it('sits at the equinox of date at the March equinox', () => {
    // 2025 March 20, 09:07 UT. The equinox of date has moved ~1,250″ from J2000's in 25 years,
    // so the check is made in the frame of date.
    const jd = julianDayNumber(2_460_754.88);
    const { ra, dec } = raDecFromVector(apply(precessionMatrix(jd), sunPositionJ2000(jd)));
    expect(Math.min(ra, 2 * Math.PI - ra) / ARCSECOND).toBeLessThan(120);
    expect(Math.abs(dec) / ARCSECOND).toBeLessThan(60);
  });
});

describe('raDecFromVector', () => {
  it('inverts directionFromRaDec', () => {
    const { ra, dec } = raDecFromVector(directionFromRaDec(5, -0.3));
    expect(ra).toBeCloseTo(5, 12);
    expect(dec).toBeCloseTo(-0.3, 12);
  });
});
