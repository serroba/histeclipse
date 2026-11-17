/**
 * Which way a craft points (#796), by a stated convention, not as it was each moment: Webb's
 * sunshield always faces the Sun, so its model's +Y points away from it; where it looks within
 * its field of regard is not known here, so its mirror (+Z) is turned toward the celestial
 * north, square to the Sun's line. Hubble points wherever it is observing; its aperture (+Z) is
 * kept away from the Sun, its other axes turned the same way.
 */

import { Matrix4, Quaternion, Vector3 } from 'three';

/** The model's axis kept pointing away from the Sun. */
export type AwayAxis = 'y' | 'z';

/** The scene's celestial north (Earth's pole is +Y in the scene's axes). */
const NORTH = new Vector3(0, 1, 0);
const ASIDE = new Vector3(1, 0, 0);

/**
 * The turn taking the model's axes into the scene's, for a craft at `at` with the Sun at `sun`
 * (both scene positions): its `away` axis pointing from the Sun, the next one round toward the
 * north as far as it can be, square to the first.
 */
export function awayFromSun(at: Vector3, sun: Vector3, away: AwayAxis): Quaternion {
  const fromSun = at.clone().sub(sun).normalize();
  // North, unless the Sun lies right along it; then any square direction will do.
  const up = Math.abs(fromSun.dot(NORTH)) > 0.999 ? ASIDE : NORTH;
  const toNorth = up
    .clone()
    .sub(fromSun.clone().multiplyScalar(up.dot(fromSun)))
    .normalize();
  const third = new Vector3().crossVectors(fromSun, toNorth);
  // Right-handed: x × y = z. Away along y, north along z, so x is y × z; away along z, north
  // along y, so x is y × z again, from the other two.
  const basis =
    away === 'y'
      ? new Matrix4().makeBasis(third, fromSun, toNorth)
      : new Matrix4().makeBasis(third.negate(), toNorth, fromSun);
  return new Quaternion().setFromRotationMatrix(basis);
}
