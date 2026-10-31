import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  altitude,
  angularDistance,
  longitudeUncertainty,
  moonVisibility,
  shiftLongitude,
} from './visibility';

const BABYLON = { latitude: 32.5422, longitude: 44.4209 };
const MEXICO_CITY = { latitude: 19.4326, longitude: -99.1332 };

describe('angularDistance', () => {
  it.each([
    [{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 90 }, 90],
    [{ latitude: 90, longitude: 0 }, { latitude: -90, longitude: 0 }, 180],
    [{ latitude: 10, longitude: 170 }, { latitude: 10, longitude: -170 }, 19.69],
  ])('%o to %o is %d°', (a, b, degrees) => {
    expect(angularDistance(a, b)).toBeCloseTo(degrees, 2);
  });

  it('is symmetric and at most 180°', () => {
    const points = fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true }),
    });
    fc.assert(
      fc.property(points, points, (a, b) => {
        const distance = angularDistance(a, b);
        expect(distance).toBeCloseTo(angularDistance(b, a), 9);
        expect(distance).toBeGreaterThanOrEqual(0);
        expect(distance).toBeLessThanOrEqual(180 + 1e-9);
      }),
    );
  });
});

describe('moonVisibility', () => {
  // 621 BCE April 22: Ptolemy records this eclipse as observed in Babylon. The catalog puts
  // the Moon overhead at 8.91°S 32.10°W at greatest eclipse, with ΔT uncertain by ±476 s.
  const babylonEclipse = { latitude: -8.91, longitude: -32.1 };

  it('has the 621 BCE eclipse above the horizon in Babylon, as recorded', () => {
    expect(altitude(babylonEclipse, BABYLON)).toBeCloseTo(6.4, 0);
    expect(moonVisibility(babylonEclipse, BABYLON, 476)).toBe('visible');
  });

  it('has the 2025 March 14 eclipse visible from Mexico and not from Iraq', () => {
    const march2025 = { latitude: 2.68, longitude: -102.25 };
    expect(moonVisibility(march2025, MEXICO_CITY, 3)).toBe('visible');
    expect(moonVisibility(march2025, BABYLON, 3)).toBe('hidden');
  });

  it('is uncertain near the horizon when ΔT is uncertain', () => {
    // An observer on the equator with the Moon 1° above the western horizon. ±1 hour of ΔT
    // moves the sub-lunar point by 15° of longitude, enough to set the Moon.
    const observer = { latitude: 0, longitude: 0 };
    const nearHorizon = { latitude: 0, longitude: -89 };
    expect(altitude(nearHorizon, observer)).toBeCloseTo(1, 9);
    expect(moonVisibility(nearHorizon, observer, 0)).toBe('visible');
    expect(moonVisibility(nearHorizon, observer, 3600)).toBe('uncertain');
  });
});

describe('longitude helpers', () => {
  it('converts ΔT uncertainty to longitude at the sidereal rate', () => {
    expect(longitudeUncertainty(86_164.0905)).toBeCloseTo(360, 9);
    expect(longitudeUncertainty(476)).toBeCloseTo(1.99, 2);
  });

  it('wraps shifted longitudes', () => {
    expect(shiftLongitude({ latitude: 5, longitude: 175 }, 10)).toEqual({
      latitude: 5,
      longitude: -175,
    });
    expect(shiftLongitude({ latitude: 5, longitude: -175 }, -10).longitude).toBeCloseTo(175, 9);
  });
});
