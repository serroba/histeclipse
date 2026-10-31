/**
 * Wrapping a full-disk image of the Sun onto a sphere. The image shows the hemisphere that faces
 * Earth, solar north up and solar west to the right (as the sky looks from Earth), so a point on
 * the Sun's surface lands where an orthographic view from Earth puts it. The far side was not
 * seen and gets no image.
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
 * Where the surface point with outward unit normal `normal` appears in the image, as texture
 * coordinates (0..1, v up), or null on the far side. `toEarth` points from the Sun to Earth,
 * `north` along the Sun's rotation axis; `diskRadius` is the limb's radius in the image.
 */
export function sunImageUv(
  normal: Vector3,
  toEarth: Vector3,
  north: Vector3,
  diskRadius: number,
): readonly [u: number, v: number] | null {
  if (dot(normal, toEarth) < 0) return null;
  // Solar north as seen from Earth: the pole's direction across the line of sight.
  const along = dot(north, toEarth);
  const up = unit([
    north[0] - along * toEarth[0],
    north[1] - along * toEarth[1],
    north[2] - along * toEarth[2],
  ]);
  // Looking from Earth toward the Sun, with north up, right is west.
  const right = cross([-toEarth[0], -toEarth[1], -toEarth[2]], up);
  return [0.5 + diskRadius * dot(normal, right), 0.5 + diskRadius * dot(normal, up)];
}

/** Heliographic latitude of the centre of the disc seen from Earth (B₀), degrees. */
export function diskCentreLatitude(toEarth: Vector3, north: Vector3): number {
  return Math.asin(dot(unit(toEarth), unit(north))) / RADIANS;
}
