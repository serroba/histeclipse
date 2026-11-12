/**
 * How fast the orbit controls zoom and turn, by how far the camera is from the body in focus.
 *
 * A wheel step scales the distance from the centre. Far out, bigger steps put the Sun a few
 * spins away. Near the ground a step of the usual size would cover the whole height at once:
 * 50 km above Earth (#568) a step is 4% of the distance, five times the height. There the step
 * shrinks with the height, so each one still takes about an eighth of the way down. A drag turns
 * the globe slower the same way: across the screen, by some ten times the ground in view rather
 * than half a turn. From one and a half radii out, both are as they were.
 */

/** Wheel and drag speeds at `distance` from the centre of a body of `radius` (same units). */
export function controlSpeeds(
  distance: number,
  radius: number,
): { readonly zoom: number; readonly rotate: number } {
  const ratio = distance / radius;
  if (ratio >= 10) return { zoom: 2.5, rotate: 0.5 };
  const height = Math.max(ratio - 1, 0);
  return {
    zoom: 0.8 * Math.min(1, (3 * height) / ratio),
    rotate: Math.min(0.5, height),
  };
}
