/**
 * Where the naked-eye planets are: VSOP87 (Bretagnon & Francou 1988, via astronomia, MIT),
 * heliocentric positions in the J2000 ecliptic, turned into geocentric J2000 equatorial
 * vectors. Its error against DE441 over 4000 BCE to 3000 CE is measured in the tests against
 * reference positions from JPL Horizons (`test-vectors/planets.json`).
 *
 * The series data (~1.5 MB raw) loads on demand.
 */

import type { Planet, VsopData } from 'astronomia/planetposition';

import type { JulianDay } from '../time/julianDay';
import { eclipticToEquatorial, type EquatorialVector } from './moon';

export const PLANETS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn'] as const;
export type PlanetName = (typeof PLANETS)[number];

const KM_PER_AU = 149_597_870.7;
/** Light's travel time for one AU, in days. */
const LIGHT_DAYS_PER_AU = 499.004_783_836 / 86_400;

/**
 * How far VSOP87 can be from DE441, by era: the worst error found in 200 samples a planet
 * across 4000 BCE–3000 CE (see the tests), rounded up. Rows are [from year, arcminutes]; a
 * row holds until the next one. Jupiter and Saturn drift in the remote past, where VSOP87's
 * long-period terms lose accuracy; since 1000 BCE every planet is within half an arcminute.
 */
export const PLANET_UNCERTAINTY: Readonly<
  Record<PlanetName, readonly (readonly [number, number])[]>
> = {
  mercury: [[-4000, 0.5]],
  venus: [[-4000, 0.5]],
  mars: [[-4000, 0.5]],
  jupiter: [
    [-4000, 8],
    [-3000, 3],
    [-2000, 1],
    [-1000, 0.5],
  ],
  saturn: [
    [-4000, 20],
    [-3000, 6],
    [-2000, 2.5],
    [-1000, 0.5],
  ],
};

/** The error budget (arcminutes) for a planet in an astronomical year. */
export function planetUncertainty(planet: PlanetName, year: number): number {
  let budget = PLANET_UNCERTAINTY[planet][0]?.[1] ?? 0;
  for (const [from, arcminutes] of PLANET_UNCERTAINTY[planet])
    if (year >= from) budget = arcminutes;
  return budget;
}

export interface PlanetEphemeris {
  /** Geometric geocentric position in km, J2000 equator (≈ ICRF), at a TT Julian Day. */
  position(planet: PlanetName, jdTT: JulianDay): EquatorialVector;
  /** Where the planet is seen: its position when the light now arriving left it. */
  apparent(planet: PlanetName, jdTT: JulianDay): EquatorialVector;
}

type Theory = Pick<Planet, 'position2000'>;

function heliocentric(theory: Theory, jd: number): [number, number, number] {
  const { lon, lat, range } = theory.position2000(jd);
  const across = range * Math.cos(lat);
  return [across * Math.cos(lon), across * Math.sin(lon), range * Math.sin(lat)];
}

export function createPlanetEphemeris(
  data: Readonly<Record<PlanetName | 'earth', VsopData>>,
  PlanetClass: new (data: VsopData) => Theory,
): PlanetEphemeris {
  const theories = {
    earth: new PlanetClass(data.earth),
    mercury: new PlanetClass(data.mercury),
    venus: new PlanetClass(data.venus),
    mars: new PlanetClass(data.mars),
    jupiter: new PlanetClass(data.jupiter),
    saturn: new PlanetClass(data.saturn),
  };

  function geocentricAu(planet: PlanetName, jdPlanet: number, jdEarth: number): number[] {
    const target = heliocentric(theories[planet], jdPlanet);
    const earth = heliocentric(theories.earth, jdEarth);
    return [target[0] - earth[0], target[1] - earth[1], target[2] - earth[2]];
  }

  function toEquatorialKm([x = 0, y = 0, z = 0]: number[]): EquatorialVector {
    return eclipticToEquatorial(x * KM_PER_AU, y * KM_PER_AU, z * KM_PER_AU);
  }

  return {
    position(planet, jdTT) {
      return toEquatorialKm(geocentricAu(planet, jdTT, jdTT));
    },
    apparent(planet, jdTT) {
      // Two passes settle the light time to well under a second.
      let delay = 0;
      for (let pass = 0; pass < 2; pass++) {
        delay = Math.hypot(...geocentricAu(planet, jdTT - delay, jdTT)) * LIGHT_DAYS_PER_AU;
      }
      return toEquatorialKm(geocentricAu(planet, jdTT - delay, jdTT));
    },
  };
}

/** Load VSOP87 for Earth and the five planets (a separate chunk) and return the ephemeris. */
export async function loadPlanetEphemeris(): Promise<PlanetEphemeris> {
  const [{ Planet }, earth, mercury, venus, mars, jupiter, saturn] = await Promise.all([
    import('astronomia/planetposition'),
    import('astronomia/data/vsop87Bearth'),
    import('astronomia/data/vsop87Bmercury'),
    import('astronomia/data/vsop87Bvenus'),
    import('astronomia/data/vsop87Bmars'),
    import('astronomia/data/vsop87Bjupiter'),
    import('astronomia/data/vsop87Bsaturn'),
  ]);
  return createPlanetEphemeris(
    {
      earth: earth.default,
      mercury: mercury.default,
      venus: venus.default,
      mars: mars.default,
      jupiter: jupiter.default,
      saturn: saturn.default,
    },
    Planet,
  );
}

/**
 * How bright a planet looks: magnitude from its distances to the Sun (r) and to us (Δ), in AU,
 * and its phase angle i (Sun–planet–Earth) in degrees. Formulas of the Astronomical Almanac
 * (1984) as given by Meeus, Astronomical Algorithms ch. 41. For Saturn, `ringTilt` is the
 * rings' tilt toward us (B, degrees): wide-open rings make it up to ~0.9 brighter. The small
 * term for the Sun's tilt to the rings (Δu) is left out.
 */
export function planetMagnitude(
  planet: PlanetName,
  r: number,
  delta: number,
  i: number,
  ringTilt = 0,
): number {
  const distance = 5 * Math.log10(r * delta);
  switch (planet) {
    case 'mercury':
      return -0.42 + distance + 0.038 * i - 0.000_273 * i ** 2 + 0.000_002 * i ** 3;
    case 'venus':
      return -4.4 + distance + 0.0009 * i + 0.000_239 * i ** 2 - 0.000_000_65 * i ** 3;
    case 'mars':
      return -1.52 + distance + 0.016 * i;
    case 'jupiter':
      return -9.4 + distance + 0.005 * i;
    case 'saturn': {
      const sinB = Math.sin((Math.abs(ringTilt) * Math.PI) / 180);
      return -8.88 + distance - 2.6 * sinB + 1.25 * sinB * sinB;
    }
  }
}

/** Saturn's north pole (IAU WGCCRE 2015): RA 40.589°, Dec 83.537°, J2000. */
const SATURN_POLE = [
  Math.cos((83.537 * Math.PI) / 180) * Math.cos((40.589 * Math.PI) / 180),
  Math.cos((83.537 * Math.PI) / 180) * Math.sin((40.589 * Math.PI) / 180),
  Math.sin((83.537 * Math.PI) / 180),
] as const;

/** How far Saturn's rings tilt toward us (degrees, ±), from Saturn's geocentric position. */
export function saturnRingTilt(saturn: EquatorialVector): number {
  const [x, y, z] = saturn;
  const length = Math.hypot(x, y, z);
  // Earth seen from Saturn is the opposite direction.
  const along = -(x * SATURN_POLE[0] + y * SATURN_POLE[1] + z * SATURN_POLE[2]) / length;
  return (Math.asin(along) * 180) / Math.PI;
}
