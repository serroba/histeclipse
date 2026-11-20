/**
 * How fast the orbit controls zoom and turn, by how far the camera is from the body in focus.
 *
 * A wheel step scales the distance from the centre. Far out, bigger steps put the Sun a few
 * spins away. Near the ground a step of the usual size would cover the whole height at once:
 * 50 km above Earth (#568) a step is 4% of the distance, five times the height. There the step
 * shrinks with the height, so each one still takes about an eighth of the way down.
 *
 * A drag turns the body so the ground under the finger keeps up with it, no faster: three's
 * controls turn by 2π × speed for a drag the screen's height, and that height shows about
 * height × 2 tan(fov / 2) of ground, in radii of the body. Close in, the old half a turn a
 * screen threw the view across a continent with a flick; now a drag moves the ground by as much
 * as the finger moved. Out where the whole disc is in view, it turns half a turn a screen, as
 * it always did.
 */

/** Half a turn for a drag the screen's height: the fastest a drag turns. */
const FASTEST_TURN = 0.5;

/**
 * Wheel and drag speeds at `distance` from the centre of a body of `radius` (same units), with
 * the camera's vertical field of view `fovDegrees`.
 */
export function controlSpeeds(
  distance: number,
  radius: number,
  fovDegrees = 35,
): { readonly zoom: number; readonly rotate: number } {
  const ratio = distance / radius;
  const height = Math.max(ratio - 1, 0);
  const halfView = Math.tan((fovDegrees * Math.PI) / 360);
  const rotate = Math.min(FASTEST_TURN, (height * halfView) / Math.PI);
  if (ratio >= 10) return { zoom: 2.5, rotate };
  return { zoom: 0.8 * Math.min(1, (3 * height) / ratio), rotate };
}
