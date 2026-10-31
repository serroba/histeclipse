import { describe, expect, it } from 'vitest';

import { sunPositionJ2000 } from '../astro/precession';
import { starDirection, type StarMotion } from '../astro/stars';
import { subsolarPoint } from '../astro/sun';
import { julianDayNumber } from '../time/julianDay';
import {
  airmass,
  apparentDirection,
  apparentMagnitude,
  horizontal,
  horizontalOf,
  horizonMatrix,
  limitingMagnitude,
  refraction,
} from './horizon';

const BABYLON = { latitude: 32.5422, longitude: 44.4209 };
const epoch = (year: number) => julianDayNumber(2_451_545 + (year - 2000) * 365.25);

// Catalogue values from sky.json.
const POLARIS: StarMotion = {
  ra: 37.95292,
  dec: 89.26417,
  pmRa: 38,
  pmDec: -15,
  parallax: 7,
  radialVelocity: -17,
};
const THUBAN: StarMotion = {
  ra: 211.09708,
  dec: 64.37583,
  pmRa: -55,
  pmDec: 18,
  parallax: 18,
  radialVelocity: -13,
};
const ACRUX: StarMotion = {
  ra: 186.64958,
  dec: -63.09917,
  pmRa: -36,
  pmDec: -12,
  parallax: 8,
  radialVelocity: -11,
};

/** A star's altitude through one day from Babylon, every 20 minutes (UT = TT is fine here). */
function altitudesOverADay(star: StarMotion, year: number): number[] {
  const start = epoch(year);
  return Array.from({ length: 72 }, (_, step) => {
    const jd = julianDayNumber(start + step / 72);
    return horizontalOf(horizonMatrix(BABYLON, jd, jd), starDirection(star, jd)).altitude;
  });
}

describe('the sky over Babylon', () => {
  it('has Polaris near the pole today, at the height of the latitude all night', () => {
    for (const altitude of altitudesOverADay(POLARIS, 2025)) {
      expect(Math.abs(altitude - BABYLON.latitude)).toBeLessThan(1);
    }
  });

  it('had Thuban as its pole star around 2800 BCE, and Polaris wheeling far from the pole', () => {
    for (const altitude of altitudesOverADay(THUBAN, -2800)) {
      expect(Math.abs(altitude - BABYLON.latitude)).toBeLessThan(0.5);
    }
    const polaris = altitudesOverADay(POLARIS, -2800);
    expect(Math.max(...polaris) - Math.min(...polaris)).toBeGreaterThan(40);
  });

  it('saw the Southern Cross rise in 3000 BCE, which it no longer does', () => {
    expect(Math.max(...altitudesOverADay(ACRUX, -3000))).toBeGreaterThan(5);
    expect(Math.max(...altitudesOverADay(ACRUX, 2025))).toBeLessThan(0);
  });

  it('has the Sun overhead at the subsolar point', () => {
    const jdUT = julianDayNumber(2_460_409.26);
    const jdTT = julianDayNumber(2_460_409.2608);
    const sun = sunPositionJ2000(jdTT);
    const length = Math.hypot(...sun);
    const { altitude } = horizontalOf(horizonMatrix(subsolarPoint(jdUT, jdTT), jdUT, jdTT), [
      sun[0] / length,
      sun[1] / length,
      sun[2] / length,
    ]);
    expect(altitude).toBeGreaterThan(89.9);
  });
});

describe('horizontal', () => {
  it('measures azimuth from north through east', () => {
    expect(horizontal([0, 1, 0])).toEqual({ altitude: 0, azimuth: 0 });
    expect(horizontal([1, 0, 0]).azimuth).toBeCloseTo(90, 12);
    expect(horizontal([-1, 0, 0]).azimuth).toBeCloseTo(270, 12);
    expect(horizontal([0, 0, 1]).altitude).toBeCloseTo(90, 12);
  });
});

describe('the atmosphere', () => {
  it('lifts the horizon by about half a degree and barely bends light high up', () => {
    expect(refraction(0) * 60).toBeCloseTo(29, 0);
    expect(refraction(45) * 60).toBeCloseTo(1, 1);
    expect(refraction(-5)).toBe(refraction(-1));
  });

  it('is one air mass overhead and about 38 at the horizon', () => {
    expect(airmass(90)).toBeCloseTo(1, 3);
    expect(airmass(0)).toBeCloseTo(38, 0);
    expect(airmass(-3)).toBe(airmass(0));
  });

  it('dims stars toward the horizon', () => {
    expect(apparentMagnitude(2, 90)).toBeCloseTo(2, 3);
    expect(apparentMagnitude(2, 5) - 2).toBeGreaterThan(1);
  });
});

describe('apparentDirection', () => {
  const identity = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ] as const;

  it('lifts a star on the true horizon into view by about half a degree', () => {
    const lifted = horizontal(apparentDirection(identity, [1, 0, 0]));
    expect(lifted.altitude * 60).toBeCloseTo(29, 0);
    expect(lifted.azimuth).toBeCloseTo(90, 12);
  });

  it('keeps the zenith where it is', () => {
    expect(apparentDirection(identity, [0, 0, 1])).toEqual([0, 0, 1]);
  });
});

describe('limitingMagnitude', () => {
  it('shows every naked-eye star at night and almost none by day', () => {
    expect(limitingMagnitude(-30)).toBe(6.5);
    expect(limitingMagnitude(-6)).toBe(2);
    expect(limitingMagnitude(-9)).toBeCloseTo(3.5, 12);
    expect(limitingMagnitude(40)).toBe(-3.5);
  });

  it('never shows more stars as the Sun rises', () => {
    for (let altitude = -25; altitude < 20; altitude += 0.5) {
      expect(limitingMagnitude(altitude + 0.5)).toBeLessThanOrEqual(limitingMagnitude(altitude));
    }
  });
});
