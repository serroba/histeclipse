/**
 * The Sun–Earth turning frame (#995): a craft at the Sun–Earth L1 or L2 point stays near the
 * line from the Sun through Earth, and that line goes round once a year. In a fixed frame its
 * year at L2 is a ring about Earth; held so the Sun stays where it is now, the same year is the
 * transfer out and the loops about the point, as mission planners draw it.
 *
 * Each point, from Earth's centre at the moment `then` (J2000 km), is turned about the
 * ecliptic's pole by as far as the Sun has moved along the ecliptic from `then` to now.
 */

import type { Vec3 } from '../../astro/transfer';

/** IAU 2006 obliquity of the ecliptic at J2000, radians. */
const OBLIQUITY = (84_381.406 / 3600) * (Math.PI / 180);
/** The ecliptic's north pole, J2000 equatorial. */
const POLE: Vec3 = [0, -Math.sin(OBLIQUITY), Math.cos(OBLIQUITY)];
/** The Sun–Earth L1 and L2 points' distance from Earth, km. */
const L_POINT_KM = 1_500_000;

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** A direction's angle about the ecliptic's pole: its ecliptic longitude, radians. */
function longitude(v: Vec3): number {
  // Ecliptic x is the equinox (equatorial x); ecliptic y lies along the pole crossed with x.
  const y = cross(POLE, [1, 0, 0]);
  return Math.atan2(dot(v, y), v[0]);
}

/** Turn `v` about the ecliptic's pole by `angle` radians (Rodrigues). */
function turned(v: Vec3, angle: number): Vec3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const across = cross(POLE, v);
  const along = dot(POLE, v) * (1 - cos);
  return [
    v[0] * cos + across[0] * sin + POLE[0] * along,
    v[1] * cos + across[1] * sin + POLE[1] * along,
    v[2] * cos + across[2] * sin + POLE[2] * along,
  ];
}

/**
 * Where `point`, from Earth's centre when the Sun was at `sunThen`, is drawn with the Sun held
 * at `sunNow`: turned about the ecliptic's pole as far as the Sun has moved since.
 */
export function heldToSun(point: Vec3, sunThen: Vec3, sunNow: Vec3): Vec3 {
  return turned(point, longitude(sunNow) - longitude(sunThen));
}

/** The Sun–Earth L1 point (sunward) or L2 point (away from the Sun), from Earth's centre, km. */
export function lPointAt(point: 'SEL1' | 'SEL2', sun: Vec3): Vec3 {
  const scale = (point === 'SEL1' ? L_POINT_KM : -L_POINT_KM) / Math.sqrt(dot(sun, sun));
  return [sun[0] * scale, sun[1] * scale, sun[2] * scale];
}

/** The mark at the L point a mission went to (#995), with the Sun at `sun`: a route of its own. */
export function lPointRoute(
  point: 'SEL1' | 'SEL2' | null,
  sun: Vec3,
): readonly { id: string; approximate: false; points: readonly (Vec3 | null)[] }[] {
  return point === null
    ? []
    : [{ id: point, approximate: false, points: lPointMark(lPointAt(point, sun)) }];
}

/** Half the width of the mark at an L point, km: a small star of three crossed lines. */
const MARK_KM = 60_000;

/** The mark at an L point: three short lines crossing there, broken apart (null between). */
export function lPointMark(at: Vec3): readonly (Vec3 | null)[] {
  const [x, y, z] = at;
  const d = MARK_KM;
  return [
    [x - d, y, z],
    [x + d, y, z],
    null,
    [x, y - d, z],
    [x, y + d, z],
    null,
    [x, y, z - d],
    [x, y, z + d],
  ];
}
