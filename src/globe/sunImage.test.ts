import { describe, expect, it } from 'vitest';

import { sunPositionJ2000 } from '../astro/precession';
import { julianDay } from '../time/julianDay';
import { astronomicalYear } from '../time/year';
import {
  discAverage,
  diskCentreLatitude,
  limbDarkening,
  SOLAR_NORTH_POLE_J2000,
  sunImageUv,
} from './sunImage';

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

describe('discAverage', () => {
  /** A square RGBA image; `pixel` gets the offset from the centre in units of the disc's radius. */
  function image(
    size: number,
    r: number,
    pixel: (dx: number, dy: number) => readonly [number, number, number],
  ): Uint8ClampedArray {
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5 - size / 2) / (r * size);
        const dy = (y + 0.5 - size / 2) / (r * size);
        data.set([...pixel(dx, dy), 255], 4 * (y * size + x));
      }
    }
    return data;
  }

  it('averages the disc in linear light and ignores the sky and corona around it', () => {
    const pixels = image(64, 0.4, (dx, dy) =>
      Math.hypot(dx, dy) < 1 ? [255, 188, 0] : [40, 255, 255],
    );
    const [r, g, b] = discAverage(pixels, 64, 64, 0.4);
    expect(r).toBeCloseTo(1, 6);
    // sRGB 188 is about half the light of 255.
    expect(g).toBeCloseTo(0.5, 2);
    expect(b).toBe(0);
  });

  it('scales a limb-darkened disc back up to the level at its centre', () => {
    const size = 256;
    const encode = (linear: number) =>
      Math.round(
        255 * (linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055),
      );
    const pixels = image(size, 0.4, (dx, dy) => {
      const rho = Math.hypot(dx, dy);
      if (rho >= 1) return [0, 0, 0];
      const level = encode(0.8 * limbDarkening(Math.sqrt(1 - rho * rho), 0.6));
      return [level, level, level];
    });
    const [r] = discAverage(pixels, size, size, 0.4, 0.6);
    // The innermost 97% of the disc skips the darkest rim, so it comes out a little bright.
    expect(r).toBeGreaterThan(0.79);
    expect(r).toBeLessThan(0.83);
  });

  it('gives black for an image with no disc', () => {
    expect(discAverage(new Uint8ClampedArray(0), 0, 0, 0.4)).toEqual([0, 0, 0]);
  });
});
