/**
 * The asteroid belt (#372): the main belt's asteroids at least 100 km across, as JPL's
 * Small-Body Database lists them. Each orbit is a mean orbit about the Sun, on the ecliptic of
 * J2000, fitted by the pipeline's `asteroids` command to JPL Horizons from 1600 to 2500
 * (`public/data/asteroids.json`), as the moons' are: Jupiter's pull swings an asteroid to and
 * fro along its orbit, which up to two sine terms take up. Within those years half are within a
 * degree of JPL's place, 169 of the 210 within two, and those Jupiter holds in resonance (the
 * Hildas, Thule) up to 12 (each fit's worst is kept with it). Outside them
 * the orbits are carried on at the same rates: where an asteroid is along its orbit is then
 * only roughly known, a little less well each century.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../../util/fetchJson';
import { MEAN_ORBIT_ENTRIES, moonPosition } from '../../astro/moonOrbits';

const AsteroidSchema = v.strictObject({
  name: v.pipe(v.string(), v.minLength(1)),
  diameterKm: v.pipe(v.number(), v.minValue(1)),
  /** The fit's worst error at the moments it was checked, seen from the Sun, degrees. */
  offDegrees: v.pipe(v.number(), v.minValue(0)),
  ...MEAN_ORBIT_ENTRIES,
});

const AsteroidsSchema = v.strictObject({
  schemaVersion: v.literal(1),
  source: v.pipe(v.string(), v.url()),
  list: v.pipe(v.string(), v.url()),
  smallestKm: v.pipe(v.number(), v.minValue(1)),
  fittedJdTT: v.tuple([v.number(), v.number()]),
  epochJdTT: v.literal(2451545),
  asteroids: v.record(v.pipe(v.string(), v.regex(/^\d+$/)), AsteroidSchema),
});

export type AsteroidOrbit = v.InferOutput<typeof AsteroidSchema>;

/** The asteroids drawn, by number, largest first; the diameter they start at; the years fitted. */
export interface Asteroids {
  readonly asteroids: readonly (AsteroidOrbit & { readonly number: string })[];
  readonly smallestKm: number;
  readonly fitted: readonly [number, number];
}

export async function loadAsteroids(url: string, fetchJson: Fetch): Promise<Asteroids> {
  const data = await getJson(fetchJson, url, AsteroidsSchema);
  return {
    asteroids: Object.entries(data.asteroids)
      .map(([number, orbit]) => ({ ...orbit, number }))
      .sort((a, b) => b.diameterKm - a.diameterKm),
    smallestKm: data.smallestKm,
    fitted: data.fittedJdTT,
  };
}

/** Where an asteroid is at `jdTT`: km from the Sun's centre, ICRF axes. */
export function asteroidPosition(
  orbit: AsteroidOrbit,
  jdTT: number,
): readonly [number, number, number] {
  return moonPosition(orbit, jdTT);
}
