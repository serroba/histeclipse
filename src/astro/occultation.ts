/**
 * How much sunlight reaches a point when a dark body sits in front of the Sun: the visible
 * share of the Sun's disc. It gives an eclipse's umbra (none visible), penumbra (some) and
 * antumbra (a ring) from the true geometry, at any moment, for any surface point.
 *
 * The scene shaders implement the same formula in GLSL; these functions are the tested reference.
 */

import type { Vector3 } from './matrix';

/**
 * Earth's shadow is a little larger than geometry says: the atmosphere blocks light too. The
 * catalog (Skyfield, after Danjon) enlarges Earth's apparent radius by 1%; so do we.
 */
export const EARTH_SHADOW_ENLARGEMENT = 1.01;

/**
 * The share of a bright disc of angular radius `source` left visible when a dark disc of angular
 * radius `occluder` sits `separation` away (all in radians, small angles).
 */
export function visibleFraction(source: number, occluder: number, separation: number): number {
  if (separation >= source + occluder) return 1;
  if (separation <= occluder - source) return 0;
  if (separation <= source - occluder) return 1 - (occluder / source) ** 2;
  // Partial overlap: the lens where the two discs meet.
  const r1 = source;
  const r2 = occluder;
  const d = separation;
  const alpha = Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
  const beta = Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  const lens =
    r1 * r1 * (alpha - Math.sin(2 * alpha) / 2) + r2 * r2 * (beta - Math.sin(2 * beta) / 2);
  return 1 - lens / (Math.PI * r1 * r1);
}

/** Sunlight reaching `point`, from 0 (umbra) to 1, with a sphere of `occluderRadius` in the way. */
export function sunlightAt(options: {
  readonly point: Vector3;
  readonly sun: Vector3;
  readonly sunRadius: number;
  readonly occluder: Vector3;
  readonly occluderRadius: number;
}): number {
  const { point, sun, sunRadius, occluder, occluderRadius } = options;
  const toSun = difference(sun, point);
  const toOccluder = difference(occluder, point);
  const sunDistance = Math.hypot(...toSun);
  const occluderDistance = Math.hypot(...toOccluder);
  // An occluder behind the point, or the point inside it, casts no shadow on it here.
  if (occluderDistance <= occluderRadius || dot(toSun, toOccluder) <= 0) return 1;
  // atan2 of |a × b| and a · b keeps small angles exact, where acos of a cosine near 1 would
  // not (the shaders run in 32-bit floats).
  const separation = Math.atan2(Math.hypot(...cross(toSun, toOccluder)), dot(toSun, toOccluder));
  return visibleFraction(
    Math.asin(Math.min(1, sunRadius / sunDistance)),
    Math.asin(occluderRadius / occluderDistance),
    separation,
  );
}

function difference(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vector3, b: Vector3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
