/**
 * The asteroids and dwarf planets (#372, #1329): the Sun's small bodies that are large or that
 * matter, group by group. The main belt's asteroids at least 100 km across and Jupiter's Trojans
 * of that size, as JPL's Small-Body Database lists them; and a chosen few besides: near-Earth
 * asteroids, the centaurs between Jupiter and Neptune, and the largest bodies beyond Neptune,
 * the dwarf planets among them.
 *
 * Each orbit is a mean orbit on the ecliptic of J2000, fitted by the pipeline's `asteroids`
 * command to JPL Horizons (`public/data/asteroids.json`), as the moons' are: the planets' pull
 * swings a body to and fro along its orbit, which up to two sine terms take up. Each is fitted
 * to its own years (`fitted`): 1600 to 2500 for most; fewer for the centaurs and the near-Earth
 * asteroids, whose orbits the planets turn at each close pass. Each fit's worst error within
 * its years is kept with it (`offDegrees`). Outside them the orbit is carried on at the same
 * rates: where a body is along its orbit is then only roughly known, a little less well each
 * century.
 *
 * A body beyond Neptune is fitted about the Solar System's centre of mass (`about`), where its
 * orbit is steady, and drawn about the Sun, which is never more than a hundredth of an AU from
 * that centre: under a minute of arc from so far.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../../util/fetchJson';
import { MEAN_ORBIT_ENTRIES, moonPosition } from '../../astro/moonOrbits';
import { HEADER_ADDED } from '../../data/header';

/** The groups a body is drawn in, from the Sun outwards. */
export const BODY_GROUPS = [
  'near-earth',
  'main-belt',
  'trojan',
  'centaur',
  'kuiper-belt',
  'scattered-disc',
  'detached',
] as const;
export type BodyGroup = (typeof BODY_GROUPS)[number];

const JulianDay = v.pipe(v.number(), v.minValue(0));

const AsteroidSchema = v.strictObject({
  name: v.pipe(v.string(), v.minLength(1)),
  group: v.picklist(BODY_GROUPS),
  /** One of the five the IAU names dwarf planets. */
  dwarfPlanet: v.optional(v.literal(true)),
  diameterKm: v.pipe(v.number(), v.gtValue(0)),
  /** Whose measure its diameter is: a source's id in the registry. */
  sized: v.pipe(v.string(), v.minLength(1)),
  /** What its orbit is fitted about: the Sun, or the Solar System's centre of mass. */
  about: v.picklist(['sun', 'barycentre']),
  /** The years its orbit is fitted to (TT Julian Days). */
  fittedJdTT: v.pipe(
    v.tuple([JulianDay, JulianDay]),
    v.check(([from, to]) => from < to, 'the years fitted run forwards'),
  ),
  /** The fit's worst error at the moments it was checked, seen from the Sun, degrees. */
  offDegrees: v.pipe(v.number(), v.minValue(0)),
  ...MEAN_ORBIT_ENTRIES,
});

const AsteroidsSchema = v.strictObject({
  schemaVersion: v.literal(2),
  ...HEADER_ADDED,
  source: v.pipe(v.string(), v.url()),
  list: v.pipe(v.string(), v.url()),
  smallestKm: v.pipe(v.number(), v.minValue(1)),
  epochJdTT: v.literal(2451545),
  asteroids: v.record(v.pipe(v.string(), v.regex(/^\d+$/)), AsteroidSchema),
});

export type AsteroidOrbit = v.InferOutput<typeof AsteroidSchema>;
/** A body with the number it is catalogued by. */
export type Asteroid = AsteroidOrbit & { readonly number: string };

/**
 * The bodies drawn, by number, largest first; and the diameter the main belt's and the
 * Trojans' start at.
 */
export interface Asteroids {
  readonly asteroids: readonly Asteroid[];
  readonly smallestKm: number;
}

export async function loadAsteroids(url: string, fetchJson: Fetch): Promise<Asteroids> {
  const data = await getJson(fetchJson, url, AsteroidsSchema);
  return {
    asteroids: Object.entries(data.asteroids)
      .map(([number, orbit]) => ({ ...orbit, number }))
      .sort((a, b) => b.diameterKm - a.diameterKm),
    smallestKm: data.smallestKm,
  };
}

/** Where a body is at `jdTT`: km from the Sun's centre, ICRF axes. */
export function asteroidPosition(
  orbit: AsteroidOrbit,
  jdTT: number,
): readonly [number, number, number] {
  return moonPosition(orbit, jdTT);
}

/**
 * Whether a body's name is written beside its dot: the main belt's and the Trojans' from 200 km
 * across, as two hundred names would crowd them; every one of the few chosen elsewhere.
 */
export function isNamed(asteroid: Pick<AsteroidOrbit, 'group' | 'diameterKm'>): boolean {
  const crowded = asteroid.group === 'main-belt' || asteroid.group === 'trojan';
  return !crowded || asteroid.diameterKm >= NAMED_FROM_KM;
}

/** The crowded groups' bodies named, those at least this wide, km. */
const NAMED_FROM_KM = 200;
