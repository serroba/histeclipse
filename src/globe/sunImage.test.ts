import { describe, expect, it } from 'vitest';

import { sunPositionJ2000 } from '../astro/precession';
import { julianDay } from '../time/julianDay';
import { astronomicalYear } from '../time/year';
import { diskCentreLatitude, SOLAR_NORTH_POLE_J2000, sunImageUv } from './sunImage';

const toEarth = [1, 0, 0] as const;
const north = [0, 0, 1] as const;

describe('sunImageUv', () => {
  it('puts the point facing Earth in the middle of the image', () => {
    expect(sunImageUv([1, 0, 0], toEarth, north, 0.4)).toEqual([0.5, 0.5]);
  });

  it('puts the north pole at the top limb and the west limb on the right', () => {
    const [u, v] = sunImageUv([0, 0, 1], toEarth, north, 0.4) ?? [0, 0];
    expect(u).toBeCloseTo(0.5, 12);
    expect(v).toBeCloseTo(0.9, 12);
    // Looking from +x toward the Sun with north up (+z), the right-hand side is +y.
    const [west] = sunImageUv([0, 1, 0], toEarth, north, 0.4) ?? [0];
    expect(west).toBeCloseTo(0.9, 12);
  });

  it('leaves the far side without an image', () => {
    expect(sunImageUv([-1, 0, 0], toEarth, north, 0.4)).toBeNull();
  });

  it('keeps north up when the pole leans toward Earth', () => {
    const leaning = [Math.sin(0.12), 0, Math.cos(0.12)] as const;
    const [, v] = sunImageUv([0, 0, 1], toEarth, leaning, 0.4) ?? [0, 0];
    expect(v).toBeCloseTo(0.9, 12);
  });
});

describe('SOLAR_NORTH_POLE_J2000', () => {
  // The disc's centre drifts between ±7.25° of solar latitude through the year: 0 in early June
  // and early December, +7.25° in early September, −7.25° in early March.
  const b0 = (month: number, day: number) => {
    const jd = julianDay({ year: astronomicalYear(2024), month, day, calendar: 'gregorian' });
    const [x, y, z] = sunPositionJ2000(jd);
    return diskCentreLatitude([-x, -y, -z], SOLAR_NORTH_POLE_J2000);
  };

  it('tilts the north pole toward Earth by 7.25° in September and away in March', () => {
    expect(b0(9, 8)).toBeCloseTo(7.25, 1);
    expect(b0(3, 7)).toBeCloseTo(-7.25, 1);
    expect(Math.abs(b0(6, 6))).toBeLessThan(0.2);
    expect(Math.abs(b0(12, 8))).toBeLessThan(0.2);
  });
});
