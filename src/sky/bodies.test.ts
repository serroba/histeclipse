import data from 'astronomia/data/elpMppDe';
import { Moon } from 'astronomia/elp';
import { describe, expect, it } from 'vitest';

import { IDENTITY, type Vector3 } from '../astro/matrix';
import { longTermEarthFixedToJ2000 } from '../astro/longTermPrecession';
import { createMoonEphemeris } from '../astro/moon';
import { sunPositionJ2000 } from '../astro/precession';
import type { GeoPoint } from '../state/viewState';
import { julianDayNumber } from '../time/julianDay';
import {
  angleBetween,
  angularRadius,
  eclipsedLimit,
  illuminatedFraction,
  moonSunlight,
  observerPosition,
  sunVisible,
  topocentric,
} from './bodies';

const moonEphemeris = createMoonEphemeris(data, Moon);
const SUN: Vector3 = [149_600_000, 0, 0];

/** Sun and Moon seen from `place` at a TT Julian Day, with ΔT in seconds. */
function seenFrom(place: GeoPoint | null, jdTT: number, deltaT: number) {
  const tt = julianDayNumber(jdTT);
  const observer =
    place === null
      ? ([0, 0, 0] as const)
      : observerPosition(
          place,
          longTermEarthFixedToJ2000(julianDayNumber(jdTT - deltaT / 86_400), tt),
        );
  return {
    sun: topocentric(sunPositionJ2000(tt), observer),
    moon: topocentric(moonEphemeris.position(tt), observer),
  };
}

describe('observerPosition', () => {
  it('puts the equator at Greenwich on the x axis at the equatorial radius', () => {
    const [x, y, z] = observerPosition({ latitude: 0, longitude: 0 }, IDENTITY);
    expect(x).toBeCloseTo(6378.137, 6);
    expect(Math.hypot(y, z)).toBeLessThan(1e-9);
  });

  it('puts the North Pole at the polar radius', () => {
    const [x, y, z] = observerPosition({ latitude: 90, longitude: 45 }, IDENTITY);
    expect(z).toBeCloseTo(6356.752, 3);
    expect(Math.hypot(x, y)).toBeLessThan(1e-9);
  });
});

describe('angles', () => {
  it('measures angles between directions and apparent sizes', () => {
    expect(angleBetween([1, 0, 0], [0, 2, 0])).toBeCloseTo(Math.PI / 2, 12);
    expect(angleBetween([1, 0, 0], [1, 1e-9, 0])).toBeCloseTo(1e-9, 18);
    // The Moon at its mean distance: about a quarter of a degree in radius.
    expect((angularRadius(1737.4, [384_400, 0, 0]) * 180) / Math.PI).toBeCloseTo(0.259, 3);
    expect(angularRadius(2, [1, 0, 0])).toBeCloseTo(Math.PI / 2, 12);
  });
});

describe('illuminatedFraction', () => {
  it('is full opposite the Sun, new beside it and half at quarter', () => {
    expect(illuminatedFraction([-384_400, 0, 0], SUN)).toBeCloseTo(1, 6);
    expect(illuminatedFraction([384_400, 0, 0], SUN)).toBeCloseTo(0, 6);
    expect(illuminatedFraction([0, 384_400, 0], SUN)).toBeCloseTo(0.5, 2);
  });
});

describe('sunVisible', () => {
  it('hides the whole Sun on the central line at greatest eclipse, 8 April 2024', () => {
    // NASA: greatest eclipse 18:17:16 TT at 25.29° N, 104.14° W; ΔT 69 s.
    const jdTT = 2_460_408.5 + (18 + 17 / 60 + 16 / 3600) / 24;
    const { sun, moon } = seenFrom({ latitude: 25.29, longitude: -104.14 }, jdTT, 69);
    expect(sunVisible(sun, moon)).toBe(0);
    // From Earth's centre at the same moment the Moon is half a degree off: only partial.
    const centre = seenFrom(null, jdTT, 69);
    expect(sunVisible(centre.sun, centre.moon)).toBeGreaterThan(0.2);
  });

  it('hides the whole Sun over Romania on 11 August 1999', () => {
    // NASA: greatest eclipse 11:03:07 TT at 45.1° N, 24.3° E; ΔT 64 s.
    const jdTT = 2_451_401.5 + (11 + 3 / 60 + 7 / 3600) / 24;
    const { sun, moon } = seenFrom({ latitude: 45.1, longitude: 24.3 }, jdTT, 64);
    expect(sunVisible(sun, moon)).toBe(0);
  });

  it('leaves a ring in the annular eclipse of 14 October 2023', () => {
    // NASA: greatest eclipse 18:00:41 TT at 11.4° N, 83.1° W; magnitude 0.952.
    const jdTT = 2_460_231.5 + (18 + 41 / 3600) / 24;
    const { sun, moon } = seenFrom({ latitude: 11.4, longitude: -83.1 }, jdTT, 69);
    expect(sunVisible(sun, moon)).toBeCloseTo(1 - 0.952 ** 2, 2);
  });

  it('is 1 with the Moon away from the Sun', () => {
    expect(sunVisible(SUN, [-384_400, 0, 0])).toBe(1);
  });
});

describe('moonSunlight', () => {
  it('is dark in the middle of the umbra and full outside the shadow', () => {
    expect(moonSunlight([-384_400, 0, 0], SUN)).toBe(0);
    expect(moonSunlight([-384_400, 20_000, 0], SUN)).toBe(1);
    // Between the umbra and the penumbra's edge, partly lit.
    const edge = moonSunlight([-384_400, 6000, 0], SUN);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
  });

  it('puts the Moon in the umbra at greatest eclipse, 8 November 2022', () => {
    // NASA: greatest eclipse 10:59:11 TT, umbral magnitude 1.359.
    const jdTT = julianDayNumber(2_459_891.5 + (10 + 59 / 60 + 11 / 3600) / 24);
    expect(moonSunlight(moonEphemeris.position(jdTT), sunPositionJ2000(jdTT))).toBe(0);
  });
});

describe('eclipsedLimit', () => {
  it('leaves the limit alone in full sunlight', () => {
    expect(eclipsedLimit(-3.5, 1)).toBe(-3.5);
  });

  it('brings out the brightest stars in totality', () => {
    expect(eclipsedLimit(-3.5, 0)).toBeCloseTo(1.5, 6);
    expect(eclipsedLimit(-3.5, 0.5)).toBeCloseTo(-3.5 + 1.25 * Math.log10(2), 6);
  });

  it('never goes past a dark night sky', () => {
    expect(eclipsedLimit(6, 0)).toBe(6.5);
  });
});
