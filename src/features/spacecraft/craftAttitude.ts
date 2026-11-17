/**
 * Which way a craft points (#796), by a stated convention, not as it was each moment. Each model
 * keeps its +Y away from the Sun and its +Z (the way it looks) square to the Sun's line, turned
 * toward the celestial north:
 *
 * - Webb: its sunshield always faces the Sun, so +Y away from it is so; where it looks within its
 *   field of regard is not known here.
 * - Hubble: its solar arrays turn on their masts to face the Sun, and it is never pointed near
 *   it; where it is looking at a given moment is not known here.
 */

import { Matrix4, Quaternion, Vector3 } from 'three';

/** The scene's celestial north (Earth's pole is +Y in the scene's axes). */
const NORTH = new Vector3(0, 1, 0);
const ASIDE = new Vector3(1, 0, 0);

/**
 * The turn taking the model's axes into the scene's, for a craft at `at` with the Sun at `sun`
 * (both scene positions): its +Y pointing from the Sun, its +Z toward the north as far as it can
 * be, square to the first.
 */
export function awayFromSun(at: Vector3, sun: Vector3): Quaternion {
  const fromSun = at.clone().sub(sun).normalize();
  // North, unless the Sun lies right along it; then any square direction will do.
  const up = Math.abs(fromSun.dot(NORTH)) > 0.999 ? ASIDE : NORTH;
  const toNorth = up
    .clone()
    .sub(fromSun.clone().multiplyScalar(up.dot(fromSun)))
    .normalize();
  // Right-handed: x is y × z.
  const aside = new Vector3().crossVectors(fromSun, toNorth);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(aside, fromSun, toNorth));
}
