import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { julianDayNumber } from '../time/julianDay';
import type { Vector3 } from './matrix';
import { loadMoonEphemeris } from './moon';
import { EARTH_SHADOW_ENLARGEMENT, sunlightAt, visibleFraction } from './occultation';
import { sunPositionJ2000 } from './precession';

describe('visibleFraction', () => {
  it('is whole when the discs are apart, and nothing when the occluder covers', () => {
    expect(visibleFraction(1, 1, 2.5)).toBe(1);
    expect(visibleFraction(1, 2, 0.5)).toBe(0);
  });

  it('leaves a ring when a smaller occluder sits inside (an annular eclipse)', () => {
    expect(visibleFraction(1, 0.9, 0.05)).toBeCloseTo(1 - 0.81, 12);
  });

  it('matches the lens area for equal discs one radius apart', () => {
    // Overlap of two unit circles at distance 1 is 2π/3 − √3/2.
    expect(visibleFraction(1, 1, 1)).toBeCloseTo(
      1 - ((2 * Math.PI) / 3 - Math.sqrt(3) / 2) / Math.PI,
      12,
    );
  });

  it('stays in [0, 1] and grows as the discs part', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 2, noNaN: true }),
        fc.double({ min: 0.1, max: 2, noNaN: true }),
        fc.double({ min: 0, max: 4, noNaN: true }),
        fc.double({ min: 0, max: 0.5, noNaN: true }),
        (source, occluder, separation, step) => {
          const near = visibleFraction(source, occluder, separation);
          const far = visibleFraction(source, occluder, separation + step);
          expect(near).toBeGreaterThanOrEqual(-1e-12);
          expect(far).toBeLessThanOrEqual(1 + 1e-12);
          expect(far).toBeGreaterThanOrEqual(near - 1e-9);
        },
      ),
    );
  });
});

describe('sunlightAt', () => {
  it('is full sunlight with the occluder behind the point', () => {
    expect(
      sunlightAt({
        point: [0, 0, 0],
        sun: [100, 0, 0],
        sunRadius: 1,
        occluder: [-5, 0, 0],
        occluderRadius: 1,
      }),
    ).toBe(1);
  });
});

// Real lunar eclipses at greatest eclipse (NASA Five Millennium Canon, TD), in Earth radii:
// the Moon's centre and its sunward-facing limb, lit or shadowed by Earth.
describe('Earth’s shadow on the Moon', async () => {
  const moon = await loadMoonEphemeris();
  const EARTH_KM = 6378.137;
  const MOON_RADIUS = 1737.4 / EARTH_KM;
  const SUN_RADIUS = 696_000 / EARTH_KM;
  const scale = (v: Vector3): Vector3 => [v[0] / EARTH_KM, v[1] / EARTH_KM, v[2] / EARTH_KM];

  function lightOnMoon(jdTT: number): { centre: number; darkest: number; brightest: number } {
    const jd = julianDayNumber(jdTT);
    const centre = scale(moon.position(jd));
    const sun = scale(sunPositionJ2000(jd));
    const light = (point: Vector3): number =>
      sunlightAt({
        point,
        sun,
        sunRadius: SUN_RADIUS,
        occluder: [0, 0, 0],
        occluderRadius: EARTH_SHADOW_ENLARGEMENT,
      });
    // Sample the Moon's surface on a fine grid.
    let darkest = 1;
    let brightest = 0;
    for (let i = 0; i <= 36; i++) {
      for (let j = 0; j < 72; j++) {
        const theta = (i / 36) * Math.PI;
        const phi = (j / 72) * 2 * Math.PI;
        const value = light([
          centre[0] + MOON_RADIUS * Math.sin(theta) * Math.cos(phi),
          centre[1] + MOON_RADIUS * Math.sin(theta) * Math.sin(phi),
          centre[2] + MOON_RADIUS * Math.cos(theta),
        ]);
        darkest = Math.min(darkest, value);
        brightest = Math.max(brightest, value);
      }
    }
    return { centre: light(centre), darkest, brightest };
  }

  it('puts the whole Moon in the umbra at 2025 Mar 14 (total, umbral magnitude 1.18)', () => {
    // 06:58:43 TD
    const { brightest } = lightOnMoon(2_460_748.790_775);
    expect(brightest).toBe(0);
  });

  it('dips only the southern limb into the umbra at 2024 Sep 18 (partial, 0.085)', () => {
    // 02:44:17 TD
    const { centre, darkest } = lightOnMoon(2_460_571.614_086);
    expect(darkest).toBe(0);
    expect(centre).toBeGreaterThan(0);
  });

  it('keeps the Moon out of the umbra at 2023 May 5 (penumbral, umbral −0.05)', () => {
    // 17:24:05 TD
    const { centre, darkest } = lightOnMoon(2_460_070.225_058);
    // The limb nearest the umbra sees a sliver of the Sun; the centre, a little over half.
    expect(darkest).toBeGreaterThan(0);
    expect(darkest).toBeLessThan(0.05);
    expect(centre).toBeGreaterThan(0.4);
    expect(centre).toBeLessThan(0.75);
  });
});
