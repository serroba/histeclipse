/**
 * The turn that carries the Sun's direction from one moment to another (#995, #998): about the
 * ecliptic's pole, by as far as the Sun has moved along the ecliptic, in J2000 equatorial axes.
 * Held to it, the line from the Sun through Earth stays put: a craft at the Sun–Earth L2 point
 * stays at one place, and a camera turned by it keeps its view of the point.
 */

import type { Matrix3, Vector3 } from './matrix';

/** IAU 2006 obliquity of the ecliptic at J2000, radians. */
const OBLIQUITY = (84_381.406 / 3600) * (Math.PI / 180);
/** The ecliptic's north pole, J2000 equatorial. */
const POLE: Vector3 = [0, -Math.sin(OBLIQUITY), Math.cos(OBLIQUITY)];
/** The ecliptic's y axis (x is the equinox): the pole crossed with x. */
const ECLIPTIC_Y: Vector3 = [0, Math.cos(OBLIQUITY), Math.sin(OBLIQUITY)];

/** A direction's angle about the ecliptic's pole: its ecliptic longitude, radians. */
function longitude([x, y, z]: Vector3): number {
  return Math.atan2(y * ECLIPTIC_Y[1] + z * ECLIPTIC_Y[2], x);
}

/** The turn about the ecliptic's pole that takes the Sun at `from` to where it is at `to`. */
export function sunTurn(from: Vector3, to: Vector3): Matrix3 {
  const angle = longitude(to) - longitude(from);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const t = 1 - cos;
  const [x, y, z] = POLE;
  // Rodrigues: cos·I + sin·[pole]× + (1 − cos)·pole poleᵀ.
  return [
    [cos + t * x * x, t * x * y - sin * z, t * x * z + sin * y],
    [t * y * x + sin * z, cos + t * y * y, t * y * z - sin * x],
    [t * z * x - sin * y, t * z * y + sin * x, cos + t * z * z],
  ];
}
