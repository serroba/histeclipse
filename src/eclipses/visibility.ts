/**
 * Where an eclipsed Moon was above the horizon, and how sure we can be.
 *
 * The Moon is up where its geocentric altitude is positive, i.e. within 90° of the point where
 * it stands overhead. Two small effects are ignored because they nearly cancel near the horizon:
 * lunar parallax lowers the Moon by up to 0.95°, refraction lifts it by about 0.57°.
 *
 * ΔT is the dominant uncertainty for ancient dates. If ΔT were larger by Δ seconds, the same
 * astronomical instant happened Δ seconds earlier in Earth's rotation, so the sub-lunar point
 * sits Δ / 239.34 degrees further east (Earth turns once per 86,164 s relative to the stars).
 */

import type { GeoPoint } from '../state/viewState';

const RADIANS = Math.PI / 180;
export const SECONDS_PER_DEGREE_OF_ROTATION = 86_164.0905 / 360;

export type Visibility = 'visible' | 'hidden' | 'uncertain';

/** Great-circle distance in degrees. */
export function angularDistance(a: GeoPoint, b: GeoPoint): number {
  const dLat = (b.latitude - a.latitude) * RADIANS;
  const dLon = (b.longitude - a.longitude) * RADIANS;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * RADIANS) * Math.cos(b.latitude * RADIANS) * Math.sin(dLon / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / RADIANS;
}

/** Altitude in degrees of a body standing overhead at `subpoint`, seen from `observer`. */
export function altitude(subpoint: GeoPoint, observer: GeoPoint): number {
  return 90 - angularDistance(subpoint, observer);
}

/** How far ΔT uncertainty can move a sub-point east or west, in degrees of longitude. */
export function longitudeUncertainty(deltaTUncertaintySeconds: number): number {
  return deltaTUncertaintySeconds / SECONDS_PER_DEGREE_OF_ROTATION;
}

export function shiftLongitude(point: GeoPoint, degrees: number): GeoPoint {
  const longitude = ((((point.longitude + degrees + 180) % 360) + 360) % 360) - 180;
  return { latitude: point.latitude, longitude };
}

/**
 * Whether the Moon was above `observer`'s horizon at the moment it stood over `sublunar`,
 * allowing for ΔT uncertainty. "uncertain" means the answer changes within ±1σ of ΔT.
 */
export function moonVisibility(
  sublunar: GeoPoint,
  observer: GeoPoint,
  deltaTUncertaintySeconds: number,
): Visibility {
  const shift = longitudeUncertainty(deltaTUncertaintySeconds);
  const answers = [-shift, 0, shift].map(
    (degrees) => altitude(shiftLongitude(sublunar, degrees), observer) > 0,
  );
  if (answers.every(Boolean)) return 'visible';
  if (!answers.some(Boolean)) return 'hidden';
  return 'uncertain';
}
