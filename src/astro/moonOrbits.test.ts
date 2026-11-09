import { describe, expect, it } from 'vitest';

import data from '../../public/data/moon-orbits.json';
import reference from '../../test-vectors/moons.json';
import { loadMoonOrbits, moonPosition, MOONS, type MoonName } from './moonOrbits';

const file = JSON.stringify(data);
const serve = (body: string) => () => Promise.resolve(new Response(body));
const orbits = await loadMoonOrbits('moon-orbits.json', serve(file));

/** The angle between two directions from the planet, degrees. */
function apart(a: readonly number[], b: readonly number[]): number {
  const [ax = 0, ay = 0, az = 0] = a;
  const [bx = 0, by = 0, bz = 0] = b;
  const cross = Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
  return (Math.atan2(cross, ax * bx + ay * by + az * bz) * 180) / Math.PI;
}

/**
 * How far from JPL's place each moon may be, degrees as seen from its planet, 1750 to 2200: what
 * the mean orbit leaves out, with room to spare. Mimas swings some 44° (its resonance with
 * Tethys), which two sine terms follow to under half a degree; Hyperion's swing waxes and wanes,
 * which they follow only to some four.
 */
const WITHIN: Readonly<Record<MoonName, number>> = {
  phobos: 0.3,
  deimos: 0.3,
  io: 0.1,
  europa: 0.2,
  ganymede: 0.3,
  callisto: 0.15,
  mimas: 0.6,
  enceladus: 0.1,
  tethys: 0.15,
  dione: 0.1,
  rhea: 0.2,
  titan: 0.1,
  hyperion: 5,
  iapetus: 0.3,
};

describe('the moons going round their planets, against JPL Horizons', () => {
  for (const moon of Object.values(MOONS).flat()) {
    it(`Given ${moon}’s mean orbit, Then it is within ${String(WITHIN[moon])}° of JPL’s place, 1750 to 2200`, () => {
      for (const { jdTT, x, y, z } of reference.moons[moon]) {
        expect(apart(moonPosition(orbits[moon], jdTT), [x, y, z])).toBeLessThan(WITHIN[moon]);
      }
    });
  }

  it('Given a moon, Then it is as far from its planet as its orbit says', () => {
    const [x, y, z] = moonPosition(orbits.titan, 2451545);
    expect(Math.hypot(x, y, z) / orbits.titan.axisKm).toBeCloseTo(1, 1);
  });

  it('Given a file missing a moon, Then it is refused', async () => {
    const bad = JSON.parse(file) as { moons: Record<string, unknown> };
    delete bad.moons['iapetus'];
    await expect(loadMoonOrbits('moon-orbits.json', serve(JSON.stringify(bad)))).rejects.toThrow(
      'every moon',
    );
  });
});
