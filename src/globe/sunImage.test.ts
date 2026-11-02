import { describe, expect, it } from 'vitest';

import { sunPositionJ2000 } from '../astro/precession';
import { julianDay } from '../time/julianDay';
import { astronomicalYear } from '../time/year';
import { diskCentreLatitude, limbDarkening, SOLAR_NORTH_POLE_J2000, sunMapUv } from './sunImage';

const toEarth = [1, 0, 0] as const;
const north = [0, 0, 1] as const;

describe('sunMapUv', () => {
  it('puts the point facing Earth in the middle of the map', () => {
    const [u, v] = sunMapUv([1, 0, 0], toEarth, north);
    expect(u).toBeCloseTo(0.5, 12);
    expect(v).toBeCloseTo(0.5, 12);
  });

  it('puts the poles at the top and bottom, and west to the right', () => {
    expect(sunMapUv([0, 0, 1], toEarth, north)[1]).toBeCloseTo(1, 12);
    expect(sunMapUv([0, 0, -1], toEarth, north)[1]).toBeCloseTo(0, 12);
    // Looking from +x toward the Sun with north up (+z), the west limb is +y: 90° west.
    expect(sunMapUv([0, 1, 0], toEarth, north)[0]).toBeCloseTo(0.75, 12);
    expect(sunMapUv([0, -1, 0], toEarth, north)[0]).toBeCloseTo(0.25, 12);
  });

  it('puts the far side at the map’s left and right edges, which meet', () => {
    const [u] = sunMapUv([-1, 0, 0], toEarth, north);
    expect(Math.min(u, 1 - u)).toBeCloseTo(0, 12);
    const [justWest] = sunMapUv([-1, 1e-9, 0], toEarth, north);
    const [justEast] = sunMapUv([-1, -1e-9, 0], toEarth, north);
    expect(justWest).toBeCloseTo(1, 6);
    expect(justEast).toBeCloseTo(0, 6);
  });

  it('measures latitude from the true pole when it leans toward Earth', () => {
    const tilt = 0.12;
    const leaning = [Math.sin(tilt), 0, Math.cos(tilt)] as const;
    // The point facing Earth then lies at a latitude of B₀ = tilt, on the central meridian.
    const [u, v] = sunMapUv([1, 0, 0], toEarth, leaning);
    expect(u).toBeCloseTo(0.5, 12);
    expect(v).toBeCloseTo(0.5 + tilt / Math.PI, 12);
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

describe('limbDarkening', () => {
  it('is 1 at the centre of the disc and 1 − u at the limb', () => {
    expect(limbDarkening(1, 0.6)).toBe(1);
    expect(limbDarkening(0, 0.6)).toBeCloseTo(0.4, 12);
    expect(limbDarkening(0.5, 0.6)).toBeCloseTo(0.7, 12);
  });

  it('stays at the limb value beyond it, and is flat without a coefficient', () => {
    expect(limbDarkening(-0.5, 0.6)).toBeCloseTo(0.4, 12);
    expect(limbDarkening(0.2, 0)).toBe(1);
  });
});
