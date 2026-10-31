/**
 * The Sun and Moon as someone standing on the ground sees them.
 *
 * The Moon is close enough that where you stand matters: across Earth its place in the sky
 * shifts by up to two degrees (four Moon widths), which is why a solar eclipse is total in a
 * narrow band and partial or nothing elsewhere. So everything here is topocentric: measured
 * from the observer's spot on the surface, not from Earth's centre.
 */

import { apply, type Matrix3, type Vector3 } from '../astro/matrix';
import { EARTH_SHADOW_ENLARGEMENT, sunlightAt, visibleFraction } from '../astro/occultation';
import type { GeoPoint } from '../state/viewState';

export const EARTH_RADIUS_KM = 6378.137;
export const MOON_RADIUS_KM = 1737.4;
export const SUN_RADIUS_KM = 696_000;
/** WGS 84: Earth is a little flattened at the poles. */
const FLATTENING = 1 / 298.257_223_563;
const RADIANS = Math.PI / 180;

/**
 * Where a place on the ground (at sea level) is, in km from Earth's centre, in the J2000
 * equatorial frame; `earthFixedToJ2000` gives Earth's orientation at the moment.
 */
export function observerPosition(place: GeoPoint, earthFixedToJ2000: Matrix3): Vector3 {
  const lat = place.latitude * RADIANS;
  const lon = place.longitude * RADIANS;
  const e2 = FLATTENING * (2 - FLATTENING);
  const sinLat = Math.sin(lat);
  // Radius of curvature in the prime vertical.
  const n = EARTH_RADIUS_KM / Math.sqrt(1 - e2 * sinLat * sinLat);
  const earthFixed: Vector3 = [
    n * Math.cos(lat) * Math.cos(lon),
    n * Math.cos(lat) * Math.sin(lon),
    n * (1 - e2) * sinLat,
  ];
  return apply(earthFixedToJ2000, earthFixed);
}

/** A body's position as seen from the observer: both vectors in km from Earth's centre. */
export function topocentric(body: Vector3, observer: Vector3): Vector3 {
  return [body[0] - observer[0], body[1] - observer[1], body[2] - observer[2]];
}

/** Apparent angular radius (radians) of a sphere of `radiusKm` at `position` (km). */
export function angularRadius(radiusKm: number, position: Vector3): number {
  return Math.asin(Math.min(1, radiusKm / Math.hypot(...position)));
}

/** Angle (radians) between two directions; exact for small angles too. */
export function angleBetween(a: Vector3, b: Vector3): number {
  const cross = Math.hypot(
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  );
  return Math.atan2(cross, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
}

/**
 * Share of the Moon's disc that is sunlit as the observer sees it, from 0 (new) to 1 (full).
 * Both positions are topocentric, in km.
 */
export function illuminatedFraction(moon: Vector3, sun: Vector3): number {
  // The phase angle: at the Moon, between the Sun and the observer.
  const phaseAngle = angleBetween(topocentric(sun, moon), [-moon[0], -moon[1], -moon[2]]);
  return (1 + Math.cos(phaseAngle)) / 2;
}

/**
 * Share of the Sun's disc the observer still sees past the Moon: 1 outside an eclipse, 0 in
 * totality, a ring's worth in an annular eclipse. Both positions are topocentric, in km.
 */
export function sunVisible(sun: Vector3, moon: Vector3): number {
  return visibleFraction(
    angularRadius(SUN_RADIUS_KM, sun),
    angularRadius(MOON_RADIUS_KM, moon),
    angleBetween(sun, moon),
  );
}

/**
 * Sunlight reaching the middle of the Moon past Earth, from 1 (no eclipse) to 0 (deep in the
 * umbra): a lunar eclipse looks the same from everywhere the Moon is up. Geocentric km.
 */
export function moonSunlight(moon: Vector3, sun: Vector3): number {
  return sunlightAt({
    point: moon,
    sun,
    sunRadius: SUN_RADIUS_KM,
    occluder: [0, 0, 0],
    occluderRadius: EARTH_RADIUS_KM * EARTH_SHADOW_ENLARGEMENT,
  });
}

/** The darkest a total eclipse makes the sky, relative to full daylight: about 1/10,000. */
const DARKEST_ECLIPSE_SKY = 1e-4;
/** Naked-eye limit in the darkest sky. */
const DARK_SKY_LIMIT = 6.5;

/**
 * The faintest star the eye picks out when the Sun is partly hidden: the sky dims with the
 * Sun's light, and the limit rises by about 1.25 magnitudes for each tenfold dimming. In
 * totality that brings out the brightest stars and planets in the middle of the day.
 */
export function eclipsedLimit(limit: number, sunlight: number): number {
  if (sunlight >= 1) return limit;
  const dimming = Math.max(sunlight, DARKEST_ECLIPSE_SKY);
  return Math.min(DARK_SKY_LIMIT, limit + 1.25 * Math.log10(1 / dimming));
}
