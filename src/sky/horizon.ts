/**
 * The sky as an observer on the ground sees it: directions in the local horizon frame, the
 * atmosphere's bending and dimming near the horizon, and how faint a star can be and still be
 * seen at a given Sun altitude.
 */

import { apply, multiply, transpose, type Matrix3, type Vector3 } from '../astro/matrix';
import { longTermEarthFixedToJ2000 } from '../astro/longTermPrecession';
import type { GeoPoint } from '../state/viewState';
import type { JulianDay } from '../time/julianDay';

const RADIANS = Math.PI / 180;

/**
 * Matrix taking J2000 equatorial vectors to the local horizon frame at `place`: x east,
 * y north, z up. Earth's orientation uses the long-term precession, valid for millennia.
 */
export function horizonMatrix(place: GeoPoint, jdUT: JulianDay, jdTT: JulianDay): Matrix3 {
  const lat = place.latitude * RADIANS;
  const lon = place.longitude * RADIANS;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);
  const earthFixedToHorizon: Matrix3 = [
    [-sinLon, cosLon, 0],
    [-sinLat * cosLon, -sinLat * sinLon, cosLat],
    [cosLat * cosLon, cosLat * sinLon, sinLat],
  ];
  return multiply(earthFixedToHorizon, transpose(longTermEarthFixedToJ2000(jdUT, jdTT)));
}

export interface Horizontal {
  /** Degrees above the horizon (negative below). */
  readonly altitude: number;
  /** Degrees from north through east, 0..360. */
  readonly azimuth: number;
}

/** Altitude and azimuth of a horizon-frame vector (x east, y north, z up). */
export function horizontal([east, north, up]: Vector3): Horizontal {
  const azimuth = Math.atan2(east, north) / RADIANS;
  return {
    altitude: Math.atan2(up, Math.hypot(east, north)) / RADIANS,
    azimuth: azimuth < 0 ? azimuth + 360 : azimuth,
  };
}

/** Altitude and azimuth of a J2000 direction, seen at `place`. */
export function horizontalOf(horizon: Matrix3, j2000: Vector3): Horizontal {
  return horizontal(apply(horizon, j2000));
}

/**
 * How much the atmosphere lifts an object (degrees), from its true altitude: Sæmundsson
 * (1986), for 10 °C and 1010 hPa. About 29′ at the horizon, 1′ at 45°. Below a degree under
 * the horizon the value is held, since nothing there is seen anyway.
 */
export function refraction(trueAltitude: number): number {
  const h = Math.max(trueAltitude, -1);
  return 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * RADIANS) / 60;
}

/**
 * Air masses along the line of sight at an apparent altitude, relative to the zenith
 * (Kasten & Young 1989): 1 overhead, about 38 at the horizon.
 */
export function airmass(apparentAltitude: number): number {
  const h = Math.max(apparentAltitude, 0);
  return 1 / (Math.sin(h * RADIANS) + 0.50572 * (h + 6.07995) ** -1.6364);
}

/** Magnitudes lost per air mass in a clear, dark-site sky. */
export const EXTINCTION_PER_AIRMASS = 0.2;

/** A star's magnitude as seen through the atmosphere: dimmer toward the horizon. */
export function apparentMagnitude(vmag: number, apparentAltitude: number): number {
  return vmag + EXTINCTION_PER_AIRMASS * (airmass(apparentAltitude) - 1);
}

/**
 * The faintest magnitude the eye picks out, by the Sun's altitude: about 6.5 in a dark
 * ancient sky, fewer stars through twilight, and only the very brightest in daylight.
 * Interpolated between rough naked-eye values.
 */
const LIMITS: readonly (readonly [number, number])[] = [
  [-18, 6.5], // astronomical night
  [-12, 5], // end of nautical twilight
  [-6, 2], // end of civil twilight: the first bright stars
  [0, -1], // sunset
  [10, -3.5], // day
];

export function limitingMagnitude(sunAltitude: number): number {
  const [first] = LIMITS;
  const last = LIMITS[LIMITS.length - 1];
  if (first === undefined || last === undefined) return 6.5;
  if (sunAltitude <= first[0]) return first[1];
  if (sunAltitude >= last[0]) return last[1];
  for (let i = 1; i < LIMITS.length; i++) {
    const [altitude, limit] = LIMITS[i] ?? last;
    const [previousAltitude, previousLimit] = LIMITS[i - 1] ?? first;
    if (sunAltitude <= altitude) {
      const t = (sunAltitude - previousAltitude) / (altitude - previousAltitude);
      return previousLimit + t * (limit - previousLimit);
    }
  }
  return last[1];
}

/**
 * Where a J2000 direction appears at `place`, refraction included: a unit vector in the
 * horizon frame (x east, y north, z up), lifted by the atmosphere toward the zenith.
 */
export function apparentDirection(horizon: Matrix3, j2000: Vector3): Vector3 {
  const [east, north, up] = apply(horizon, j2000);
  const across = Math.hypot(east, north);
  if (across === 0) return [east, north, up];
  const trueAltitude = Math.atan2(up, across) / RADIANS;
  const altitude = (trueAltitude + refraction(trueAltitude)) * RADIANS;
  const scale = Math.cos(altitude) / across;
  return [east * scale, north * scale, Math.sin(altitude)];
}
