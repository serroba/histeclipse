/**
 * Wrapping a full-disk image of the Sun onto a sphere. The image shows the hemisphere that faces
 * Earth, solar north up and solar west to the right (as the sky looks from Earth), so a point on
 * the Sun's surface lands where an orthographic view from Earth puts it. The far side was not
 * seen and gets no image: it is drawn as a plain surface at the image's average colour.
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

/**
 * Brightness across the disc of a limb-darkened Sun, relative to its centre: I = 1 − u(1 − μ),
 * with μ the cosine between the surface normal and the line of sight. u ≈ 0.6 in visible light.
 */
export function limbDarkening(mu: number, coefficient: number): number {
  return 1 - coefficient * (1 - Math.max(0, mu));
}

/** sRGB-encoded 0..255 to linear light 0..1, as the GPU decodes an sRGB texture. */
function linearFromSrgb(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * The average colour of the disc in an RGBA image (rows top down, sRGB), in linear light: the
 * quiet Sun's typical level in that channel. Only pixels well inside the limb count, so the dark
 * sky and the corona beyond do not. A limb-darkened disc averages 1 − u/3 of its centre, so
 * with a `limbDarkening` coefficient u the result is scaled back up to the centre's level.
 */
export function discAverage(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  diskRadius: number,
  limbDarkeningCoefficient = 0,
): readonly [r: number, g: number, b: number] {
  const limit = diskRadius * 0.97 * width;
  const sum = [0, 0, 0];
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2) > limit) continue;
      const i = 4 * (y * width + x);
      for (let c = 0; c < 3; c++) sum[c] = (sum[c] ?? 0) + linearFromSrgb(pixels[i + c] ?? 0);
      count++;
    }
  }
  const scale = 1 / Math.max(1, count) / (1 - limbDarkeningCoefficient / 3);
  return [(sum[0] ?? 0) * scale, (sum[1] ?? 0) * scale, (sum[2] ?? 0) * scale];
}
