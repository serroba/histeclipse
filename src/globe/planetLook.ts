/**
 * What the naked-eye planets look like in the space view: true sizes and shapes, the
 * directions of their poles, and approximate colours.
 *
 * Sizes and poles are from the IAU Working Group on Cartographic Coordinates and Rotational
 * Elements (Archinal et al. 2018, the 2015 report), at J2000; the poles drift by well under a
 * degree over the site's span, which a view this small cannot show. Saturn's ring radii are from
 * NASA's Saturnian Rings Fact Sheet. Colours are rough true-colour impressions, with Jupiter's and
 * Saturn's main belts placed at their usual latitudes: they are not maps of the surfaces.
 */

import type { PlanetName } from '../astro/planets';
import { EARTH_RADIUS_KM } from './spaceFrame';

export interface PlanetShape {
  /** Equatorial and polar radii, km. */
  readonly equatorialKm: number;
  readonly polarKm: number;
  /** North pole, J2000 right ascension and declination, degrees. */
  readonly poleRa: number;
  readonly poleDec: number;
}

export const PLANET_SHAPES: Readonly<Record<PlanetName, PlanetShape>> = {
  mercury: { equatorialKm: 2440.53, polarKm: 2438.26, poleRa: 281.0103, poleDec: 61.4155 },
  venus: { equatorialKm: 6051.8, polarKm: 6051.8, poleRa: 272.76, poleDec: 67.16 },
  mars: { equatorialKm: 3396.19, polarKm: 3376.2, poleRa: 317.269202, poleDec: 54.432516 },
  jupiter: { equatorialKm: 71_492, polarKm: 66_854, poleRa: 268.056595, poleDec: 64.495303 },
  saturn: { equatorialKm: 60_268, polarKm: 54_364, poleRa: 40.589, poleDec: 83.537 },
};

export const PLANET_NAMES: Readonly<Record<PlanetName, string>> = {
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
};

/** Equatorial radius in Earth radii, the unit of the scene. */
export function planetRadius(planet: PlanetName): number {
  return PLANET_SHAPES[planet].equatorialKm / EARTH_RADIUS_KM;
}

/** Polar over equatorial radius: how much the planet is squashed at the poles. */
export function polarRatio(planet: PlanetName): number {
  const { equatorialKm, polarKm } = PLANET_SHAPES[planet];
  return polarKm / equatorialKm;
}

/** The north pole as a unit vector in J2000 equatorial axes. */
export function poleVector(planet: PlanetName): [number, number, number] {
  const { poleRa, poleDec } = PLANET_SHAPES[planet];
  const ra = (poleRa * Math.PI) / 180;
  const dec = (poleDec * Math.PI) / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/** A band of colour between two latitudes (degrees, south to north). */
export interface Band {
  readonly south: number;
  readonly north: number;
  readonly colour: string;
}

export interface PlanetColours {
  readonly base: string;
  readonly bands: readonly Band[];
}

export const PLANET_COLOURS: Readonly<Record<PlanetName, PlanetColours>> = {
  mercury: { base: '#8c8680', bands: [] },
  venus: { base: '#e6d8b8', bands: [] },
  mars: {
    base: '#b5603a',
    bands: [
      { south: -90, north: -78, colour: '#e8e4dc' },
      { south: 80, north: 90, colour: '#efece6' },
    ],
  },
  jupiter: {
    base: '#e3d6bd',
    bands: [
      { south: -90, north: -45, colour: '#a89a86' },
      { south: -32, north: -26, colour: '#b9a184' },
      { south: -20, north: -7, colour: '#a7825d' },
      { south: 7, north: 17, colour: '#9f7a57' },
      { south: 24, north: 31, colour: '#b7a083' },
      { south: 45, north: 90, colour: '#a89a86' },
    ],
  },
  saturn: {
    base: '#e2cf9e',
    bands: [
      { south: -90, north: -60, colour: '#b9ab86' },
      { south: -30, north: -18, colour: '#cdb47c' },
      { south: 18, north: 30, colour: '#cdb47c' },
      { south: 60, north: 90, colour: '#a9a185' },
    ],
  },
};

/** The colour at a latitude: the last band covering it, or the base. */
export function colourAt(planet: PlanetName, latitude: number): string {
  const { base, bands } = PLANET_COLOURS[planet];
  return (
    bands.findLast(({ south, north }) => latitude >= south && latitude <= north)?.colour ?? base
  );
}

/** Saturn's rings, km from the planet's centre: inner edge of the C ring to outer edge of the A. */
export const SATURN_RINGS_KM = { inner: 74_658, outer: 136_775 } as const;

/**
 * How opaque Saturn's rings are at a distance from its centre (km): the faint C ring, the
 * dense B ring, the Cassini Division, the A ring and the Encke Gap. Rough optical depths.
 */
export function ringOpacity(radiusKm: number): number {
  if (radiusKm < SATURN_RINGS_KM.inner || radiusKm > SATURN_RINGS_KM.outer) return 0;
  if (radiusKm < 92_000) return 0.12; // C ring
  if (radiusKm < 117_580) return 0.85; // B ring
  if (radiusKm < 122_170) return 0.08; // Cassini Division
  if (Math.abs(radiusKm - 133_589) < 160) return 0.05; // Encke Gap
  return 0.55; // A ring
}
