import earth from 'astronomia/data/vsop87Bearth';
import jupiter from 'astronomia/data/vsop87Bjupiter';
import mars from 'astronomia/data/vsop87Bmars';
import mercury from 'astronomia/data/vsop87Bmercury';
import saturn from 'astronomia/data/vsop87Bsaturn';
import venus from 'astronomia/data/vsop87Bvenus';
import { Planet } from 'astronomia/planetposition';
import { describe, expect, it } from 'vitest';

import apparentReference from '../../test-vectors/planets-apparent.json';
import reference from '../../test-vectors/planets.json';
import { aberrate, earthVelocity } from '../sky/horizon';
import { julianDayNumber } from '../time/julianDay';
import { sunPositionJ2000 } from './precession';
import {
  createPlanetEphemeris,
  loadPlanetEphemeris,
  planetMagnitude,
  planetUncertainty,
  PLANETS,
  saturnRingTilt,
} from './planets';

const ephemeris = createPlanetEphemeris({ earth, mercury, venus, mars, jupiter, saturn }, Planet);
const ARCMINUTE = Math.PI / 180 / 60;
const LIGHT_KM_PER_DAY = 299_792.458 * 86_400;

function apart(a: readonly number[], b: readonly number[]): number {
  const [ax = 0, ay = 0, az = 0] = a;
  const [bx = 0, by = 0, bz = 0] = b;
  const cross = Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
  return Math.atan2(cross, ax * bx + ay * by + az * bz);
}

describe('planets against DE441 (JPL Horizons), 4000 BCE to 3000 CE', () => {
  for (const planet of PLANETS) {
    it(`keeps ${planet} within its published error budget at every sample`, () => {
      for (const { jdTT, x, y, z } of reference.planets[planet]) {
        const year = 2000 + (jdTT - 2_451_545) / 365.25;
        const error = apart(ephemeris.position(planet, julianDayNumber(jdTT)), [x, y, z]);
        expect(error / ARCMINUTE).toBeLessThan(planetUncertainty(planet, year));
      }
    });
  }

  it('is within half an arcminute for every planet since 1000 BCE', () => {
    for (const planet of PLANETS) expect(planetUncertainty(planet, -999)).toBe(0.5);
    expect(planetUncertainty('saturn', -3500)).toBe(20);
    expect(planetUncertainty('jupiter', -2500)).toBe(3);
  });
});

describe('apparent positions', () => {
  it('show a planet where it was when its light left', () => {
    const jd = julianDayNumber(2_451_545);
    const geometric = ephemeris.position('saturn', jd);
    const apparent = ephemeris.apparent('saturn', jd);
    // Saturn is about 8.2 AU away at J2000: light takes about 68 minutes, and in that time
    // Saturn moves on by a few arcseconds.
    const delay = Math.hypot(...apparent) / LIGHT_KM_PER_DAY;
    expect(delay * 1440).toBeGreaterThan(60);
    expect(delay * 1440).toBeLessThan(75);
    const shift = apart(geometric, apparent) / ARCMINUTE;
    expect(shift).toBeGreaterThan(0.01);
    expect(shift).toBeLessThan(0.2);
  });
});

describe('loadPlanetEphemeris', () => {
  it('loads the series on demand and gives the same positions', async () => {
    const loaded = await loadPlanetEphemeris();
    const jd = julianDayNumber(2_451_545);
    expect(loaded.position('mars', jd)).toEqual(ephemeris.position('mars', jd));
  });
});

describe('planetMagnitude', () => {
  it('gives well-known brightnesses', () => {
    // Venus at greatest brilliancy (crescent, about 0.4 AU away): about −4.7.
    const venus = planetMagnitude('venus', 0.723, 0.4, 118);
    expect(venus).toBeGreaterThan(-4.9);
    expect(venus).toBeLessThan(-4.5);
    // Mars at its close 2003 opposition: about −2.9.
    expect(planetMagnitude('mars', 1.381, 0.373, 6)).toBeCloseTo(-2.9, 1);
    // Jupiter at a typical opposition: about −2.9.
    expect(planetMagnitude('jupiter', 5.0, 4.0, 0)).toBeCloseTo(-2.9, 1);
    // Saturn's globe at opposition, rings edge-on: about +0.7; rings wide open: about −0.3.
    expect(planetMagnitude('saturn', 9.5, 8.5, 0)).toBeCloseTo(0.7, 1);
    expect(planetMagnitude('saturn', 9.5, 8.5, 0, 26.7)).toBeCloseTo(-0.3, 1);
    // Mercury near greatest elongation: around 0.
    const mercury = planetMagnitude('mercury', 0.4, 0.8, 90);
    expect(mercury).toBeGreaterThan(-0.5);
    expect(mercury).toBeLessThan(1);
  });
});

describe('saturnRingTilt', () => {
  it('opens the rings wide in 2003, edge-on in 2025, and about 21° in late 2020', () => {
    const tilt = (jd: number) => saturnRingTilt(ephemeris.position('saturn', julianDayNumber(jd)));
    // 2003 Mar 1: B ≈ −26° (south face, near its widest).
    expect(tilt(2_452_699.5)).toBeLessThan(-24);
    // 2025 Mar 23: the ring-plane crossing.
    expect(Math.abs(tilt(2_460_757.5))).toBeLessThan(1.5);
    // 2020 Dec 21, the great conjunction: about +21°.
    expect(tilt(2_459_205.5)).toBeGreaterThan(19);
    expect(tilt(2_459_205.5)).toBeLessThan(23);
  });
});

describe('apparent places against DE441 with light time and aberration (1900–2100)', () => {
  const ARCSECOND = Math.PI / 180 / 3600;
  const sunAt = (jd: number) => sunPositionJ2000(julianDayNumber(jd));

  for (const planet of PLANETS) {
    it(`puts ${planet} within 2″ of JPL's apparent direction`, () => {
      let without = 0;
      for (const { jdTT, x, y, z } of apparentReference.planets[planet]) {
        const jd = julianDayNumber(jdTT);
        const seen = aberrate(ephemeris.apparent(planet, jd), earthVelocity(sunAt, jdTT));
        expect(apart(seen, [x, y, z]) / ARCSECOND).toBeLessThan(2);
        without = Math.max(without, apart(ephemeris.apparent(planet, jd), [x, y, z]) / ARCSECOND);
      }
      // Without aberration the same comparison is off by up to ~20″: the test exercises it.
      expect(without).toBeGreaterThan(10);
    });
  }
});
