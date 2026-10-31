import data from 'astronomia/data/elpMppDe';
import { Moon } from 'astronomia/elp';
import { describe, expect, it } from 'vitest';

import check from '../../test-vectors/moon-check.json';
import fitSamples from '../../test-vectors/moon.json';
import { julianDayNumber } from '../time/julianDay';
import {
  centuriesSinceJ2000,
  createMoonEphemeris,
  DE441_CORRECTION,
  eclipticToEquatorial,
  loadMoonEphemeris,
} from './moon';
import { fitSecularCorrection } from './secularFit';

const ARCSECOND = Math.PI / 180 / 3600;

function separation(a: readonly number[], b: readonly number[]): number {
  const [ax = 0, ay = 0, az = 0] = a;
  const [bx = 0, by = 0, bz = 0] = b;
  const dot = ax * bx + ay * by + az * bz;
  return (
    Math.acos(Math.min(1, dot / (Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz)))) / ARCSECOND
  );
}

/** Ecliptic longitude (J2000) of an equatorial vector, radians. */
function longitude([x, y, z]: readonly number[]): number {
  const e = 84_381.406 * ARCSECOND;
  return Math.atan2((y ?? 0) * Math.cos(e) + (z ?? 0) * Math.sin(e), x ?? 0);
}

describe('the DE441 correction', () => {
  it('is reproducible from the committed DE441 samples', () => {
    const uncorrected = createMoonEphemeris(data, Moon, [0, 0, 0]);
    const residuals = fitSamples.vectors.map((v) => {
      const model = uncorrected.position(julianDayNumber(v.jdTT));
      const difference = (longitude([v.x, v.y, v.z]) - longitude(model)) / ARCSECOND;
      return {
        T: centuriesSinceJ2000(v.jdTT),
        arcseconds: ((difference + 648_000 * 3) % 1_296_000) - 648_000,
      };
    });
    const fitted = fitSecularCorrection(residuals);
    fitted.forEach((value, index) => {
      expect(value / (DE441_CORRECTION[index] ?? Number.NaN)).toBeCloseTo(1, 3);
    });
  });
});

describe('Moon position against an independent set of DE441 samples', () => {
  const moon = createMoonEphemeris(data, Moon);
  const errors = check.vectors.map((v) => ({
    year: 2000 + (v.jdTT - 2_451_545) / 365.25,
    arcseconds: separation(moon.position(julianDayNumber(v.jdTT)), [v.x, v.y, v.z]),
    km: Math.abs(Math.hypot(...moon.position(julianDayNumber(v.jdTT))) - Math.hypot(v.x, v.y, v.z)),
  }));
  const worst = (from: number, to: number, key: 'arcseconds' | 'km') =>
    Math.max(...errors.filter((e) => e.year >= from && e.year < to).map((e) => e[key]));

  it('covers 4000 BCE to 3000 CE', () => {
    expect(errors).toHaveLength(200);
  });

  it.each<[number, number, number]>([
    // [from, to, max arcseconds]. 90″ ≈ 0.025°, about 170 km at the Moon's distance.
    [1000, 3001, 10],
    [-2000, 1000, 40],
    [-4000, -2000, 90],
  ])('is within tolerance for %i to %i', (from, to, arcseconds) => {
    expect(worst(from, to, 'arcseconds')).toBeLessThan(arcseconds);
    expect(worst(from, to, 'km')).toBeLessThan(60);
  });
});

describe('frames and loading', () => {
  it('turns the ecliptic pole into the equatorial frame by the obliquity', () => {
    const [x, y, z] = eclipticToEquatorial(0, 0, 1);
    const e = 84_381.406 * ARCSECOND;
    expect([x, y, z].map((v) => Number(v.toFixed(12)))).toEqual(
      [0, -Math.sin(e), Math.cos(e)].map((v) => Number(v.toFixed(12))),
    );
  });

  it('loads the lunar theory on demand', async () => {
    const moon = await loadMoonEphemeris();
    const distance = Math.hypot(...moon.position(julianDayNumber(2_451_545)));
    expect(distance).toBeGreaterThan(356_000);
    expect(distance).toBeLessThan(407_000);
  });
});
