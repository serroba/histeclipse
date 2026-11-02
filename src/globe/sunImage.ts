/**
 * Wrapping a map of the whole Sun onto a sphere. The map (see `data/sunImages.ts`) is
 * equirectangular in heliographic coordinates: latitude from the Sun's equator, north at the
 * top, and longitude from the central meridian, the one facing Earth, growing toward the west
 * limb (to the right as the sky looks from Earth), with the central meridian in the middle.
 *
 * The shader in `scene.ts` does the same in GLSL; this is the tested reference.
 */

import { directionFromRaDec, type Vector3 } from '../astro/matrix';

const RADIANS = Math.PI / 180;

/** The Sun's north rotation pole (IAU WGCCRE 2015): RA 286.13°, Dec 63.87°, J2000. */
export const SOLAR_NORTH_POLE_J2000: Vector3 = directionFromRaDec(
  286.13 * RADIANS,
  63.87 * RADIANS,
);

function dot(a: Vector3, b: Vector3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function unit(v: Vector3): Vector3 {
  const length = Math.hypot(...v);
  return [v[0] / length, v[1] / length, v[2] / length];
}

/**
 * Where the surface point with outward unit normal `normal` lies on the map, as texture
 * coordinates (0..1, v up). `toEarth` points from the Sun to Earth, `north` along the Sun's
 * rotation axis; both unit vectors.
 */
export function sunMapUv(
  normal: Vector3,
  toEarth: Vector3,
  north: Vector3,
): readonly [u: number, v: number] {
  // The central meridian's direction on the equator, and the direction 90° west of it.
  const along = dot(toEarth, north);
  const meridian = unit([
    toEarth[0] - along * north[0],
    toEarth[1] - along * north[1],
    toEarth[2] - along * north[2],
  ]);
  const west = cross(north, meridian);
  const latitude = Math.asin(Math.min(1, Math.max(-1, dot(normal, north))));
  const longitude = Math.atan2(dot(normal, west), dot(normal, meridian));
  return [0.5 + longitude / (2 * Math.PI), 0.5 + latitude / Math.PI];
}

/** Heliographic latitude of the centre of the disc seen from Earth (B₀), degrees. */
export function diskCentreLatitude(toEarth: Vector3, north: Vector3): number {
  return Math.asin(dot(unit(toEarth), unit(north))) / RADIANS;
}

/**
 * Brightness across the disc of a limb-darkened Sun, relative to its centre: I = 1 − u(1 − μ),
 * with μ the cosine between the surface normal and the line of sight. u ≈ 0.6 in visible light.
 */
export function limbDarkening(mu: number, coefficient: number): number {
  return 1 - coefficient * (1 - Math.max(0, mu));
}
