/**
 * Precession and Earth's orientation, for placing Earth, Moon and Sun in one inertial frame.
 *
 * Precession: IAU 1976 angles ζ, z, θ (Meeus, *Astronomical Algorithms*, eq. 21.3), the same
 * model as the sidereal time in `sun.ts`, so the two stay consistent. Nutation (< 20″) and
 * polar motion are left out: invisible at the scales the 3D view shows.
 */

import type { JulianDay } from '../time/julianDay';
import {
  apply,
  directionFromRaDec,
  multiply,
  rotationY,
  rotationZ,
  transpose,
  type Matrix3,
  type Vector3,
} from './matrix';
import { greenwichApparentSiderealTime, sunDistance, sunPosition } from './sun';

const J2000 = 2_451_545;
const ARCSECOND = Math.PI / 180 / 3600;

/** Matrix taking J2000 equatorial vectors to the mean equator and equinox of `jdTT`. */
export function precessionMatrix(jdTT: JulianDay): Matrix3 {
  const t = (jdTT - J2000) / 36_525;
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) * ARCSECOND;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) * ARCSECOND;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) * ARCSECOND;
  return multiply(rotationZ(z), multiply(rotationY(-theta), rotationZ(zeta)));
}

/**
 * Matrix taking Earth-fixed vectors (x through Greenwich, z through the North Pole) to the
 * J2000 equatorial frame: spin by sidereal time, then undo precession.
 */
export function earthFixedToJ2000(jdUT: JulianDay, jdTT: JulianDay): Matrix3 {
  const siderealTime = (greenwichApparentSiderealTime(jdUT, jdTT) * Math.PI) / 180;
  return multiply(transpose(precessionMatrix(jdTT)), rotationZ(siderealTime));
}

/** Kilometres per astronomical unit (IAU 2012). */
export const KM_PER_AU = 149_597_870.7;

/** The Sun's geocentric position in km, J2000 equatorial frame (aberration included). */
export function sunPositionJ2000(jdTT: JulianDay): Vector3 {
  const { rightAscension, declination } = sunPosition(jdTT);
  const ofDate = directionFromRaDec(
    (rightAscension * Math.PI) / 180,
    (declination * Math.PI) / 180,
  );
  const distance = sunDistance(jdTT) * KM_PER_AU;
  const [x, y, z] = apply(transpose(precessionMatrix(jdTT)), ofDate);
  return [x * distance, y * distance, z * distance];
}
