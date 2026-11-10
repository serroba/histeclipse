/**
 * The moons of Mars, Jupiter and Saturn going round their planets (#335): Phobos and Deimos,
 * the four Galilean moons, and Saturn's eight largest. Each orbit is a mean orbit whose angles
 * turn at steady rates, fitted by the pipeline's `moon-orbits` command to JPL's ephemerides
 * (Horizons) from 1750 to 2200 (`public/data/moon-orbits.json`); a moon held in resonance
 * (Mimas with Tethys, Hyperion with Titan) also swings to and fro along its orbit, as up to two
 * sine terms on its mean longitude. Within those years every moon is within a degree of JPL's
 * place but Hyperion, within five (`moonOrbits.test.ts`). Outside them it is
 * carried on at the same rates, which says where a moon was only roughly: a moon's place along
 * its orbit centuries away is unknown to a turn for Phobos, which is spiralling in.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../data/fetchJson';

export const MOONS = {
  mars: ['phobos', 'deimos'],
  jupiter: ['io', 'europa', 'ganymede', 'callisto'],
  saturn: ['mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'titan', 'hyperion', 'iapetus'],
} as const;

export type MoonPlanet = keyof typeof MOONS;
export type MoonName = (typeof MOONS)[MoonPlanet][number];

const Angle = v.pipe(v.number(), v.minValue(0), v.maxValue(360));

/** A mean orbit's elements, as the pipeline writes them, for moons and asteroids alike. */
export const MEAN_ORBIT_ENTRIES = {
  axisKm: v.pipe(v.number(), v.minValue(1)),
  eccentricity: v.pipe(v.number(), v.minValue(0), v.maxValue(0.5)),
  inclination: v.pipe(v.number(), v.minValue(0), v.maxValue(90)),
  /** Mean longitude at J2000, degrees; its motion a day; half its gain a day squared. */
  longitude: v.tuple([Angle, v.number(), v.number()]),
  /** Swings of the mean longitude: period (days), and the sine's and cosine's amplitudes. */
  swings: v.array(v.tuple([v.pipe(v.number(), v.minValue(1)), v.number(), v.number()])),
  /** Longitude of pericentre and of the node at J2000, and their motion a day. */
  pericentre: v.tuple([Angle, v.number()]),
  node: v.tuple([Angle, v.number()]),
  /** The Laplace plane's pole: right ascension and declination, ICRF. */
  pole: v.tuple([Angle, v.pipe(v.number(), v.minValue(-90), v.maxValue(90))]),
};

const OrbitSchema = v.strictObject({
  planet: v.picklist(['mars', 'jupiter', 'saturn']),
  ...MEAN_ORBIT_ENTRIES,
});

const MOON_NAMES = Object.values(MOONS).flat();

const OrbitsSchema = v.strictObject({
  schemaVersion: v.literal(1),
  source: v.pipe(v.string(), v.url()),
  epochJdTT: v.literal(2451545),
  moons: v.pipe(
    v.record(v.picklist(MOON_NAMES), OrbitSchema),
    v.check((moons) => MOON_NAMES.every((name) => name in moons), 'every moon'),
  ),
});

export type MoonOrbit = v.InferOutput<typeof OrbitSchema>;
/** A mean orbit about whatever body it goes round: a moon's, or an asteroid's about the Sun. */
export type MeanOrbit = Omit<MoonOrbit, 'planet'>;
export type MoonOrbits = Readonly<Record<MoonName, MoonOrbit>>;

export async function loadMoonOrbits(url: string, fetchJson: Fetch): Promise<MoonOrbits> {
  const { moons } = await getJson(fetchJson, url, OrbitsSchema);
  return moons as MoonOrbits;
}

const J2000 = 2451545;
const RADIANS = Math.PI / 180;

/**
 * Where a moon is at `jdTT`: km from its planet's centre, in ICRF axes. Its mean orbit's angles
 * are carried to the moment, and Kepler's equation solved for where along the ellipse it is.
 */
export function moonPosition(orbit: MeanOrbit, jdTT: number): readonly [number, number, number] {
  const t = jdTT - J2000;
  const [l0, n, half] = orbit.longitude;
  const swing = orbit.swings.reduce(
    (sum, [period, a, b]) =>
      sum + a * Math.sin((2 * Math.PI * t) / period) + b * Math.cos((2 * Math.PI * t) / period),
    0,
  );
  const lambda = (l0 + n * t + half * t * t + swing) * RADIANS;
  const peri = (orbit.pericentre[0] + orbit.pericentre[1] * t) * RADIANS;
  const node = (orbit.node[0] + orbit.node[1] * t) * RADIANS;
  const e = orbit.eccentricity;
  const mean = lambda - peri;
  let anomaly = mean;
  for (let step = 0; step < 6; step += 1) {
    anomaly -= (anomaly - e * Math.sin(anomaly) - mean) / (1 - e * Math.cos(anomaly));
  }
  const distance = orbit.axisKm * (1 - e * Math.cos(anomaly));
  const f =
    2 *
    Math.atan2(Math.sqrt(1 + e) * Math.sin(anomaly / 2), Math.sqrt(1 - e) * Math.cos(anomaly / 2));
  const u = peri - node + f;
  const i = orbit.inclination * RADIANS;
  // On the Laplace plane, x towards its node on the ICRF equator.
  const px = distance * (Math.cos(node) * Math.cos(u) - Math.sin(node) * Math.sin(u) * Math.cos(i));
  const py = distance * (Math.sin(node) * Math.cos(u) + Math.cos(node) * Math.sin(u) * Math.cos(i));
  const pz = distance * Math.sin(u) * Math.sin(i);
  const [x, y, z] = laplaceFrame(orbit.pole);
  return [
    px * x[0] + py * y[0] + pz * z[0],
    px * x[1] + py * y[1] + pz * z[1],
    px * x[2] + py * y[2] + pz * z[2],
  ];
}

type Axis = readonly [number, number, number];

/** Axes on a Laplace plane: x to its ascending node on the ICRF equator, z to its pole. */
function laplaceFrame([ra, dec]: readonly [number, number]): readonly [Axis, Axis, Axis] {
  const a = ra * RADIANS;
  const d = dec * RADIANS;
  const pole: Axis = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  // ẑ × pole, made a unit vector: (−sin a, cos a, 0).
  const x: Axis = [-Math.sin(a), Math.cos(a), 0];
  const y: Axis = [
    pole[1] * x[2] - pole[2] * x[1],
    pole[2] * x[0] - pole[0] * x[2],
    pole[0] * x[1] - pole[1] * x[0],
  ];
  return [x, y, pole];
}
