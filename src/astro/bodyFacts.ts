/**
 * What can be said of the Sun, the Moon or a planet at the moment shown, from where they are:
 * the Moon's phase and distance; a planet's distances, phase, brightness, and where it stands
 * in Earth's sky; the Sun's distance. Plain geometry on the ephemerides' positions.
 *
 * Pure; the bar that shows it is `ui/bodyBar.ts`.
 */

import type { EquatorialVector } from './moon';
import { planetMagnitude, saturnRingTilt, type PlanetName } from './planets';

const AU_KM = 149_597_870.7;
const DEGREES = 180 / Math.PI;
/** The ecliptic's tilt to the J2000 equator, for longitudes along it. */
const OBLIQUITY = 23.439_291 / DEGREES;

function length([x, y, z]: EquatorialVector): number {
  return Math.hypot(x, y, z);
}

/** The angle between two directions, degrees. */
function angleBetween(a: EquatorialVector, b: EquatorialVector): number {
  const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (length(a) * length(b));
  return Math.acos(Math.min(1, Math.max(-1, cos))) * DEGREES;
}

/** Longitude along the ecliptic, degrees [0, 360). */
function eclipticLongitude([x, y, z]: EquatorialVector): number {
  const yEcliptic = y * Math.cos(OBLIQUITY) + z * Math.sin(OBLIQUITY);
  return (((Math.atan2(yEcliptic, x) * DEGREES) % 360) + 360) % 360;
}

/** How far `body` stands east of the Sun along the ecliptic, (−180, 180]: east is evening. */
function eastOfSun(body: EquatorialVector, sun: EquatorialVector): number {
  const difference = eclipticLongitude(body) - eclipticLongitude(sun);
  return ((difference + 540) % 360) - 180;
}

/** The share of the disc lit, from the phase angle (Sun–body–Earth), degrees. */
export function litShare(phaseAngle: number): number {
  return (1 + Math.cos(phaseAngle / DEGREES)) / 2;
}

const MOON_PHASES = [
  'New Moon',
  'Waxing crescent',
  'First quarter',
  'Waxing gibbous',
  'Full Moon',
  'Waning gibbous',
  'Last quarter',
  'Waning crescent',
] as const;

/** The Moon's phase name, from how far it stands east of the Sun (0 new, 180 full). */
export function moonPhaseName(east: number): (typeof MOON_PHASES)[number] {
  const age = (east + 360) % 360;
  return MOON_PHASES[Math.round(age / 45) % 8] ?? 'New Moon';
}

export interface MoonFacts {
  readonly phase: string;
  /** Share of the disc lit, 0 to 1. */
  readonly lit: number;
  readonly km: number;
}

/** The Moon's phase and distance, from its and the Sun's geocentric positions (km). */
export function moonFacts(moon: EquatorialVector, sun: EquatorialVector): MoonFacts {
  const east = eastOfSun(moon, sun);
  // Sun–Moon–Earth: seen from the Moon, Earth and the Sun are this far apart.
  const away: EquatorialVector = [sun[0] - moon[0], sun[1] - moon[1], sun[2] - moon[2]];
  const toEarth: EquatorialVector = [-moon[0], -moon[1], -moon[2]];
  return {
    phase: moonPhaseName(east),
    lit: litShare(angleBetween(away, toEarth)),
    km: length(moon),
  };
}

export interface PlanetFacts {
  readonly fromEarthAu: number;
  readonly fromSunAu: number;
  readonly lit: number;
  readonly magnitude: number;
  /** Degrees from the Sun in Earth's sky, and on which side: east is the evening sky. */
  readonly elongation: number;
  readonly evening: boolean;
}

/**
 * A planet's distances, phase, brightness and place beside the Sun, from its geocentric
 * position and the Sun's (km), as Earth sees them.
 */
export function planetFacts(
  planet: PlanetName,
  geocentric: EquatorialVector,
  sun: EquatorialVector,
): PlanetFacts {
  const delta = length(geocentric) / AU_KM;
  const fromSun: EquatorialVector = [
    geocentric[0] - sun[0],
    geocentric[1] - sun[1],
    geocentric[2] - sun[2],
  ];
  const r = length(fromSun) / AU_KM;
  // Sun–planet–Earth.
  const phaseAngle = angleBetween(
    [-fromSun[0], -fromSun[1], -fromSun[2]],
    [-geocentric[0], -geocentric[1], -geocentric[2]],
  );
  const ringTilt = planet === 'saturn' ? saturnRingTilt(geocentric) : 0;
  return {
    fromEarthAu: delta,
    fromSunAu: r,
    lit: litShare(phaseAngle),
    magnitude: planetMagnitude(planet, r, delta, phaseAngle, ringTilt),
    elongation: angleBetween(geocentric, sun),
    evening: eastOfSun(geocentric, sun) > 0,
  };
}

const EARTH_RADIUS_KM = 6378.137;
const MOON_DISTANCE_KM = 384_400;
const ARCSECONDS = 3600 * DEGREES;

export interface EarthFromFacts {
  readonly au: number;
  /** How wide Earth looks from there, and how far the Moon can stand from it, arcseconds. */
  readonly diameter: number;
  readonly moonApart: number;
  /** Share of Earth's disc lit, as seen from there. */
  readonly lit: number;
  /** Degrees between Earth and the Sun in that sky; null seen from the Sun itself. */
  readonly fromSun: number | null;
}

/**
 * Earth as seen from a body at geocentric `observer` (km), with the Sun at geocentric `sun` (km):
 * how far, how wide, how much of it is lit, and how near the Sun it stands in that sky (#245).
 */
export function earthFromFacts(observer: EquatorialVector, sun: EquatorialVector): EarthFromFacts {
  const km = length(observer);
  const toEarth: EquatorialVector = [-observer[0], -observer[1], -observer[2]];
  const toSun: EquatorialVector = [
    sun[0] - observer[0],
    sun[1] - observer[1],
    sun[2] - observer[2],
  ];
  return {
    au: km / AU_KM,
    diameter: 2 * Math.atan(EARTH_RADIUS_KM / km) * ARCSECONDS,
    moonApart: Math.atan(MOON_DISTANCE_KM / km) * ARCSECONDS,
    // Sun–Earth–observer.
    lit: litShare(angleBetween(sun, observer)),
    fromSun: length(toSun) < EARTH_RADIUS_KM ? null : angleBetween(toEarth, toSun),
  };
}

/** Earth from afar in words: "5.40 AU away, 3.3″ across, 99% lit · 10° from the Sun, …". */
export function earthFromText(facts: EarthFromFacts): string {
  const across =
    facts.diameter >= 60
      ? `${(facts.diameter / 60).toFixed(1)}′ across`
      : `${facts.diameter.toFixed(1)}″ across`;
  const apart =
    facts.moonApart >= 600
      ? `${(facts.moonApart / 60).toFixed(0)}′`
      : `${facts.moonApart.toFixed(0)}″`;
  const { fromSun } = facts;
  const sun =
    fromSun === null
      ? ''
      : fromSun < GLARE
        ? ` · ${String(Math.round(fromSun))}° from the Sun, in its glare`
        : ` · ${String(Math.round(fromSun))}° from the Sun`;
  return `${facts.au.toFixed(2)} AU away, ${across}, ${String(Math.round(facts.lit * 100))}% lit${sun} · the Moon at most ${apart} from it`;
}

/** The Moon in words: "Waxing crescent, 23% lit · 384,000 km from Earth". */
export function moonText(facts: MoonFacts): string {
  const km = Number(facts.km.toPrecision(3)).toLocaleString('en');
  return `${facts.phase}, ${String(Math.round(facts.lit * 100))}% lit · ${km} km from Earth`;
}

/** Below this many degrees from the Sun a planet is lost in its glare. */
const GLARE = 12;

/** A planet in words: distances, lit share, brightness and where to look. */
export function planetText(facts: PlanetFacts): string {
  const sky =
    facts.elongation < GLARE
      ? 'lost in the Sun’s glare'
      : `in the ${facts.evening ? 'evening' : 'morning'} sky, ${String(Math.round(facts.elongation))}° ${facts.evening ? 'east' : 'west'} of the Sun`;
  const magnitude = facts.magnitude.toFixed(1).replace('-', '−');
  return `${facts.fromEarthAu.toFixed(2)} AU from Earth, ${facts.fromSunAu.toFixed(2)} from the Sun · ${String(Math.round(facts.lit * 100))}% lit, magnitude ${magnitude} · ${sky}`;
}

/** The Sun in words: its distance from Earth. */
export function sunText(distanceAu: number): string {
  const km = Number((distanceAu * AU_KM).toPrecision(4)).toLocaleString('en');
  return `${distanceAu.toFixed(4)} AU (${km} km) from Earth`;
}
