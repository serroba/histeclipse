/**
 * Two-body orbits in universal variables (Curtis, "Orbital Mechanics for Engineering Students",
 * algorithms 3.3 and 5.2): Lambert's problem, the orbit that goes from one point to another in a
 * given time, and Kepler's, where an orbit carries a body after a time. For the craft whose path
 * nobody published (#350): each leg is drawn as the transfer orbit between where it left and
 * where it arrived, as mission planners first draw it. Kilometres and seconds throughout.
 */

export type Vec3 = readonly [number, number, number];

/** GM of the Sun and of Earth, km³/s². */
export const GM_SUN = 1.327_124_400_18e11;
export const GM_EARTH = 398_600.4418;

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): number => Math.sqrt(dot(a, a));
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const combine = (f: number, a: Vec3, g: number, b: Vec3): Vec3 => [
  f * a[0] + g * b[0],
  f * a[1] + g * b[1],
  f * a[2] + g * b[2],
];

/** Stumpff's C(z) and S(z), for elliptic (z > 0), parabolic and hyperbolic (z < 0) orbits. */
export function stumpff(z: number): readonly [number, number] {
  if (z > 1e-8) {
    const s = Math.sqrt(z);
    return [(1 - Math.cos(s)) / z, (s - Math.sin(s)) / s ** 3];
  }
  if (z < -1e-8) {
    const s = Math.sqrt(-z);
    return [(Math.cosh(s) - 1) / -z, (Math.sinh(s) - s) / s ** 3];
  }
  return [1 / 2, 1 / 6];
}

/**
 * Lambert's problem: the velocities at `r1` and at `r2` of the orbit that goes from one to the
 * other in `seconds`, the short way round, prograde about `pole` (so a transfer between planets
 * goes the way they do). Null if there is none in under one turn.
 */
export function lambert(
  r1: Vec3,
  r2: Vec3,
  seconds: number,
  gm: number,
  pole: Vec3,
): { readonly v1: Vec3; readonly v2: Vec3 } | null {
  const n1 = norm(r1);
  const n2 = norm(r2);
  let theta = Math.acos(Math.min(1, Math.max(-1, dot(r1, r2) / (n1 * n2))));
  if (dot(cross(r1, r2), pole) < 0) theta = 2 * Math.PI - theta;
  const a = Math.sin(theta) * Math.sqrt((n1 * n2) / (1 - Math.cos(theta)));
  if (!Number.isFinite(a) || Math.abs(a) < 1e-9) return null;
  const y = (z: number): number => {
    const [c, s] = stumpff(z);
    return n1 + n2 + (a * (z * s - 1)) / Math.sqrt(c);
  };
  const late = (z: number): number => {
    const [c, s] = stumpff(z);
    const yz = y(z);
    return (yz / c) ** 1.5 * s + a * Math.sqrt(yz) - Math.sqrt(gm) * seconds;
  };
  // The time of flight rises with z: bisect between a z with y > 0 and one turn's limit.
  let low = -4 * Math.PI ** 2;
  while (y(low) <= 0) low += 0.1;
  let high = 4 * Math.PI ** 2 - 1e-6;
  if (late(low) > 0 || late(high) < 0) return null;
  for (let step = 0; step < 200; step += 1) {
    const middle = (low + high) / 2;
    if (late(middle) < 0) low = middle;
    else high = middle;
  }
  const yz = y((low + high) / 2);
  const f = 1 - yz / n1;
  const g = a * Math.sqrt(yz / gm);
  const gDot = 1 - yz / n2;
  return { v1: combine(1 / g, r2, -f / g, r1), v2: combine(gDot / g, r2, -1 / g, r1) };
}

/**
 * Kepler's problem: where an orbit from `r0` at `v0` carries a body after `seconds`.
 *
 * Kepler's equation in the universal anomaly chi rises with chi: its slope is the body's
 * distance from the centre. So its root lies between 0 and a chi far enough along, and each of
 * Newton's steps is kept between the two, halving the gap when one would leave it. Newton's
 * steps alone leave an orbit that skims its centre (a flight to the Moon from a parking orbit)
 * for places far outside the solar system (#790).
 */
export function propagate(r0: Vec3, v0: Vec3, seconds: number, gm: number): Vec3 {
  const n0 = norm(r0);
  const radial = dot(r0, v0) / n0;
  const alpha = 2 / n0 - dot(v0, v0) / gm;
  const root = Math.sqrt(gm);
  /** Kepler's equation at chi, less the time asked for, and its slope there. */
  const kepler = (chi: number): readonly [number, number] => {
    const z = alpha * chi * chi;
    const [c, s] = stumpff(z);
    return [
      ((n0 * radial) / root) * chi * chi * c +
        (1 - alpha * n0) * chi ** 3 * s +
        n0 * chi -
        root * seconds,
      ((n0 * radial) / root) * chi * (1 - z * s) + (1 - alpha * n0) * chi * chi * c + n0,
    ];
  };
  // Forwards in time chi is positive, backwards negative: `near` is the end the root is past.
  const forwards = seconds >= 0;
  let near = 0;
  let far = (root * seconds) / n0;
  while (kepler(far)[0] < 0 === forwards && far !== 0) far *= 2;
  let chi = far;
  for (let step = 0; step < 200; step += 1) {
    const [value, slope] = kepler(chi);
    if (value < 0 === forwards) near = chi;
    else far = chi;
    const newton = chi - value / slope;
    const inside = forwards ? newton > near && newton < far : newton < near && newton > far;
    const next = inside ? newton : (near + far) / 2;
    const change = next - chi;
    chi = next;
    if (Math.abs(change) < 1e-9) break;
  }
  const z = alpha * chi * chi;
  const [c, s] = stumpff(z);
  return combine(1 - (chi * chi * c) / n0, r0, seconds - (chi ** 3 * s) / root, v0);
}
