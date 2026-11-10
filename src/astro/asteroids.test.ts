import { describe, expect, it } from 'vitest';

import data from '../../public/data/asteroids.json';
import reference from '../../test-vectors/asteroids.json';
import { asteroidPosition, loadAsteroids } from './asteroids';

const file = JSON.stringify(data);
const serve = (body: string) => () => Promise.resolve(new Response(body));
const belt = await loadAsteroids('asteroids.json', serve(file));

/** The angle between two directions from the Sun, degrees. */
function apart(a: readonly number[], b: readonly number[]): number {
  const [ax = 0, ay = 0, az = 0] = a;
  const [bx = 0, by = 0, bz = 0] = b;
  const cross = Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
  return (Math.atan2(cross, ax * bx + ay * by + az * bz) * 180) / Math.PI;
}

/**
 * How far from JPL's place each may be, degrees seen from the Sun, 1600 to 2500: Ceres and
 * Vesta, little swung by Jupiter, within half a degree; Pallas and Hygiea within some two.
 */
const WITHIN: Readonly<Record<keyof typeof reference.asteroids, number>> = {
  '1': 0.5,
  '2': 2.5,
  '4': 0.5,
  '10': 2.5,
};

describe('the asteroid belt, against JPL Horizons', () => {
  for (const [number, within] of Object.entries(WITHIN)) {
    it(`Given asteroid ${number}’s mean orbit, Then it is within ${String(within)}° of JPL’s place, 1600 to 2500`, () => {
      const asteroid = belt.asteroids.find((each) => each.number === number);
      expect(asteroid).toBeDefined();
      if (asteroid === undefined) return;
      for (const { jdTT, x, y, z } of reference.asteroids[number as keyof typeof WITHIN]) {
        expect(apart(asteroidPosition(asteroid, jdTT), [x, y, z])).toBeLessThan(within);
      }
    });
  }

  it('Given the file, Then some two hundred are drawn, largest first, Ceres the largest', () => {
    expect(belt.asteroids.length).toBeGreaterThan(200);
    expect(belt.asteroids[0]?.name).toBe('Ceres');
    expect(belt.asteroids.every((each) => each.diameterKm >= belt.smallestKm)).toBe(true);
    expect(belt.fitted).toEqual([2305448.5, 2634166.5]);
  });

  it('Given Vesta, Then it goes round between Mars and Jupiter, 2.36 AU out', () => {
    const vesta = belt.asteroids.find((each) => each.name === 'Vesta');
    if (vesta === undefined) throw new Error('no Vesta');
    const [x, y, z] = asteroidPosition(vesta, 2451545);
    expect(Math.hypot(x, y, z) / 149_597_870.7).toBeGreaterThan(2.1);
    expect(Math.hypot(x, y, z) / 149_597_870.7).toBeLessThan(2.6);
  });

  it('Given a file whose asteroid has no name, Then it is refused', async () => {
    const bad = JSON.parse(file) as { asteroids: Record<string, { name: string }> };
    const ceres = bad.asteroids['1'];
    if (ceres !== undefined) ceres.name = '';
    await expect(loadAsteroids('asteroids.json', serve(JSON.stringify(bad)))).rejects.toThrow();
  });
});
