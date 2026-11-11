import { describe, expect, it } from 'vitest';

import { julianDayNumber } from '../time/julianDay';
import { DEFAULT_LOOK, SKY_FOV_RANGE } from '../state/viewState';
import { AIM_FOV, aimLook, PHONE_SKY_ALTITUDE, PLANET_SKY_FOV, phoneLook, tapLook } from './aim';
import { LOWEST_LOOK } from './look';

describe('phoneLook', () => {
  it('lowers an untouched look on an upright phone, so the horizon is in view', () => {
    expect(phoneLook(DEFAULT_LOOK, DEFAULT_LOOK, true)).toEqual({
      ...DEFAULT_LOOK,
      altitude: PHONE_SKY_ALTITUDE,
    });
  });

  it('keeps a look the reader chose, and any look on a wide screen', () => {
    const chosen = { ...DEFAULT_LOOK, altitude: 40 };
    expect(phoneLook(chosen, DEFAULT_LOOK, true)).toBe(chosen);
    const zoomed = { ...DEFAULT_LOOK, fov: DEFAULT_LOOK.fov / 2 };
    expect(phoneLook(zoomed, DEFAULT_LOOK, true)).toBe(zoomed);
    expect(phoneLook(DEFAULT_LOOK, DEFAULT_LOOK, false)).toBe(DEFAULT_LOOK);
  });
});

describe('aimLook', () => {
  // At the equator on the prime meridian, with the Sun overhead-ish to the east of the observer.
  const seen = {
    place: { latitude: 0, longitude: 0 },
    jdUT: julianDayNumber(2_451_545),
    jdTT: julianDayNumber(2_451_545),
    observer: [6378, 0, 0] as const,
    sun: [1.5e8, 0, 0] as const,
    moon: null,
  };

  it('faces the Sun, closing in no wider than the aim', () => {
    const look = aimLook(seen, 90, 'sun');
    expect(look).not.toBeNull();
    expect(look?.fov).toBe(AIM_FOV);
    expect(look?.altitude).toBeGreaterThanOrEqual(LOWEST_LOOK);
    // A narrower view stays as narrow.
    expect(aimLook(seen, 5, 'sun')?.fov).toBe(5);
  });

  it('finds no look for the Moon before its ephemeris loads', () => {
    expect(aimLook(seen, 90, 'moon')).toBeNull();
    expect(aimLook({ ...seen, moon: [384_400, 0, 0] }, 90, 'moon')).not.toBeNull();
  });
});

describe('tapLook', () => {
  it('frames a disc four times over, but no closer than the sky allows', () => {
    expect(tapLook({ azimuth: 100, altitude: 20, radius: 2 }).fov).toBe(8);
    expect(tapLook({ azimuth: 100, altitude: 20, radius: 0.001 }).fov).toBe(SKY_FOV_RANGE.min);
  });

  it('frames a planet, a point, in a few degrees, and never looks below the lowest look', () => {
    const look = tapLook({ azimuth: 100, altitude: -80, radius: 0 });
    expect(look.fov).toBe(PLANET_SKY_FOV);
    expect(look.altitude).toBe(LOWEST_LOOK);
  });
});
