/**
 * A craft between two kept points of its path (#996). The pipeline keeps as few points as draw
 * the path within a set distance with straight lines; at the scale an L point's loops are seen,
 * those lines show as corners, the kept points weeks apart. So where the path turns gently at a
 * kept point, it is drawn through it as a curve (a cubic Hermite in time): its velocity there is
 * the one a parabola through it and its two neighbours has, which is exact for steady turning.
 * Where it turns sharply (a burn, a flyby's join), the straight line is kept, as thinned: a curve
 * would swing wide of where the craft went.
 */

import { elementAt } from '../util/arrays';

/** A kept point: days since JD 2400000 (TT), and km on each axis. */
export type PathPoint = readonly [number, number, number, number];
type Vec3 = readonly [number, number, number];

/** Sharper than this between the line in and the line out, a point is a corner, radians. */
const CORNER = Math.PI / 2;

/** The straight-line velocity from point `a` to point `b`, km a day. */
function chord(a: PathPoint, b: PathPoint): Vec3 {
  const dt = b[0] - a[0];
  return dt === 0 ? [0, 0, 0] : [(b[1] - a[1]) / dt, (b[2] - a[2]) / dt, (b[3] - a[3]) / dt];
}

/** The angle between two velocities, radians; a right angle if either is none. */
function turn(a: Vec3, b: Vec3): number {
  const lengths = Math.hypot(...a) * Math.hypot(...b);
  if (lengths === 0) return CORNER;
  const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / lengths;
  return Math.acos(Math.min(1, Math.max(-1, cos)));
}

/**
 * The velocity at kept point `k`, km a day, for the segment leaving it (`side` 1) or arriving
 * (`side` -1): the parabola's through it and its neighbours where it turns gently, else the
 * segment's own straight line.
 */
function velocityAt(points: readonly PathPoint[], k: number, side: 1 | -1): Vec3 {
  const here = elementAt(points, k);
  const own =
    side === 1 ? chord(here, elementAt(points, k + 1)) : chord(elementAt(points, k - 1), here);
  if (k === 0 || k === points.length - 1) return own;
  const before = elementAt(points, k - 1);
  const after = elementAt(points, k + 1);
  const into = chord(before, here);
  const out = chord(here, after);
  if (turn(into, out) >= CORNER) return own;
  const dIn = here[0] - before[0];
  const dOut = after[0] - here[0];
  const total = dIn + dOut;
  return [
    (into[0] * dOut + out[0] * dIn) / total,
    (into[1] * dOut + out[1] * dIn) / total,
    (into[2] * dOut + out[2] * dIn) / total,
  ];
}

/** Where the craft is at `t` (days since JD 2400000), between kept points `low` and `low + 1`. */
export function between(points: readonly PathPoint[], low: number, t: number): Vec3 {
  const a = elementAt(points, low);
  if (low + 1 >= points.length) return [a[1], a[2], a[3]];
  const b = elementAt(points, low + 1);
  const dt = b[0] - a[0];
  if (dt === 0) return [a[1], a[2], a[3]];
  const s = (t - a[0]) / dt;
  const va = velocityAt(points, low, 1);
  const vb = velocityAt(points, low + 1, -1);
  // Hermite's four weights: the ends' places, and their velocities over the segment's length.
  const h00 = (1 + 2 * s) * (1 - s) * (1 - s);
  const h10 = s * (1 - s) * (1 - s) * dt;
  const h01 = s * s * (3 - 2 * s);
  const h11 = s * s * (s - 1) * dt;
  return [
    h00 * a[1] + h10 * va[0] + h01 * b[1] + h11 * vb[0],
    h00 * a[2] + h10 * va[1] + h01 * b[2] + h11 * vb[1],
    h00 * a[3] + h10 * va[2] + h01 * b[3] + h11 * vb[2],
  ];
}
