/**
 * The Sun–Earth turning frame (#995): a craft at the Sun–Earth L1 or L2 point stays near the
 * line from the Sun through Earth, and that line goes round once a year. In a fixed frame its
 * year at L2 is a ring about Earth; held so the Sun stays where it is now, the same year is the
 * transfer out and the loops about the point, as mission planners draw it.
 *
 * Each point, from Earth's centre at the moment `then` (J2000 km), is turned about the
 * ecliptic's pole by as far as the Sun has moved along the ecliptic from `then` to now.
 */

import { sunTurn } from '../../astro/eclipticTurn';
import { apply } from '../../astro/matrix';
import type { Vec3 } from '../../astro/transfer';
import type { LayerFactory } from '../../globe/layerHost';

/** The Sun–Earth L1 and L2 points' distance from Earth, km. */
const L_POINT_KM = 1_500_000;

/**
 * Where `point`, from Earth's centre when the Sun was at `sunThen`, is drawn with the Sun held
 * at `sunNow`: turned about the ecliptic's pole as far as the Sun has moved since.
 */
export function heldToSun(point: Vec3, sunThen: Vec3, sunNow: Vec3): Vec3 {
  return apply(sunTurn(sunThen, sunNow), point);
}

/** The Sun–Earth L1 point (sunward) or L2 point (away from the Sun), from Earth's centre, km. */
export function lPointAt(point: 'SEL1' | 'SEL2', sun: Vec3): Vec3 {
  const scale = (point === 'SEL1' ? L_POINT_KM : -L_POINT_KM) / Math.hypot(...sun);
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

/**
 * The far camera held to the Sun while a mission to an L point is followed (#998): its route is
 * drawn turning with the Sun–Earth line, and the camera turns with it, so the loops keep the look
 * the mission's view opened on as the year plays.
 */
export const sunHold: LayerFactory<boolean> = (host) => ({
  update(on) {
    host.holdToSun(on);
  },
});
