/**
 * Where the sky view looks: turned to the Sun or the Moon, lowered on an upright phone, or
 * closing in on a body tapped. Pure, so the sky part (#448) and the view switch share it.
 */

import type { JulianDay } from '../time/julianDay';
import type { Vector3 } from '../astro/matrix';
import type { GeoPoint, SkyLook } from '../state/viewState';
import { SKY_FOV_RANGE } from '../state/viewState';
import { horizonMatrix, horizontalOf } from './horizon';
import { topocentric } from './bodies';
import { LOWEST_LOOK, roundLook } from './look';

/** Field of view (degrees) when turning to the Sun or Moon: close enough to see the disc. */
export const AIM_FOV = 12;
/** A planet tapped in the sky: a point at any zoom, so a few degrees, its neighbours in view. */
export const PLANET_SKY_FOV = 4;
/** How high an upright phone looks on entering the sky, degrees: the horizon low in view. */
export const PHONE_SKY_ALTITUDE = 12;

/** The Sun and the Moon as seen from a place at a moment, in J2000 coordinates (km). */
export interface BodiesSeen {
  readonly place: GeoPoint;
  readonly jdUT: JulianDay;
  readonly jdTT: JulianDay;
  readonly observer: Vector3;
  readonly sun: Vector3;
  /** Null until the Moon's ephemeris loads. */
  readonly moon: Vector3 | null;
}

/**
 * On a phone held upright the sky shows less from top to bottom (#253), and the panels cover
 * much of it: an untouched look is lowered so the horizon is in view. A look the reader chose,
 * or a link's, stays as it is.
 */
export function phoneLook(look: SkyLook, untouched: SkyLook, upright: boolean): SkyLook {
  const isUntouched = look.altitude === untouched.altitude && look.fov === untouched.fov;
  if (!isUntouched || !upright) return look;
  return { ...look, altitude: PHONE_SKY_ALTITUDE };
}

/** A look facing the Sun or the Moon from where the observer stands, or null if unknown. */
export function aimLook(seen: BodiesSeen, fov: number, target: 'sun' | 'moon'): SkyLook | null {
  const body = target === 'sun' ? seen.sun : seen.moon;
  if (body === null) return null;
  const horizon = horizonMatrix(seen.place, seen.jdUT, seen.jdTT);
  const { azimuth, altitude } = horizontalOf(horizon, topocentric(body, seen.observer));
  return roundLook({
    azimuth,
    altitude: Math.max(LOWEST_LOOK, altitude),
    fov: Math.min(fov, AIM_FOV),
  });
}

/** The look that centres a body tapped in the sky: its disc four times over, or a planet's few degrees. */
export function tapLook(tap: {
  readonly azimuth: number;
  readonly altitude: number;
  readonly radius: number;
}): SkyLook {
  return roundLook({
    azimuth: tap.azimuth,
    altitude: Math.max(LOWEST_LOOK, tap.altitude),
    fov: tap.radius > 0 ? Math.max(SKY_FOV_RANGE.min, tap.radius * 4) : PLANET_SKY_FOV,
  });
}
