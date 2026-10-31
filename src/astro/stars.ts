/**
 * Where a star was, by its motion through space.
 *
 * Each star moves in a straight line at constant velocity: its catalogue position at J2000,
 * placed at its distance (from the parallax), plus its velocity across the sky (proper motion)
 * and along the line of sight (radial velocity). Over 5,000 years this matters: Arcturus moves
 * about 3°. Straight-line motion is what ERFA's `eraStarpm` assumes too; it also corrects for
 * light time, which changes the result by far less than the eye can see.
 *
 * Positions stay in the J2000 equatorial frame; precession to the sky of date comes after.
 */

import type { JulianDay } from '../time/julianDay';
import type { Vector3 } from './matrix';

const J2000 = 2_451_545;
const DAYS_PER_JULIAN_YEAR = 365.25;
const MAS = Math.PI / 180 / 3_600_000;
/** Parsecs per year at 1 km/s. */
const PARSECS_PER_YEAR_PER_KM_S = 1.022_712_165e-6;

export interface StarMotion {
  /** J2000 right ascension and declination, degrees. */
  readonly ra: number;
  readonly dec: number;
  /** Proper motion in mas/yr: along the great circle (μα cos δ), and in declination. */
  readonly pmRa: number;
  readonly pmDec: number;
  /** Parallax in mas, if measured; without one the star moves across the sky only. */
  readonly parallax: number | null;
  /** Radial velocity in km/s, if measured. */
  readonly radialVelocity: number | null;
}

/** Unit vector toward the star at `jdTT`, in the J2000 equatorial frame. */
export function starDirection(star: StarMotion, jdTT: JulianDay): Vector3 {
  const years = (jdTT - J2000) / DAYS_PER_JULIAN_YEAR;
  const ra = (star.ra * Math.PI) / 180;
  const dec = (star.dec * Math.PI) / 180;
  const cosRa = Math.cos(ra);
  const sinRa = Math.sin(ra);
  const cosDec = Math.cos(dec);
  const sinDec = Math.sin(dec);
  // Toward the star, and the directions of increasing right ascension and declination.
  const toward: Vector3 = [cosDec * cosRa, cosDec * sinRa, sinDec];
  const east: Vector3 = [-sinRa, cosRa, 0];
  const north: Vector3 = [-sinDec * cosRa, -sinDec * sinRa, cosDec];

  // Distance in parsecs; a star without a parallax keeps unit distance and no radial motion.
  const parallax = star.parallax ?? 0;
  const distance = parallax > 0 ? 1000 / parallax : 1;
  const radial = parallax > 0 ? (star.radialVelocity ?? 0) * PARSECS_PER_YEAR_PER_KM_S * years : 0;
  // Proper motion is an angle a year, so across the sky the star moves distance × angle.
  const alongRa = star.pmRa * MAS * years * distance;
  const alongDec = star.pmDec * MAS * years * distance;

  const x = toward[0] * (distance + radial) + east[0] * alongRa + north[0] * alongDec;
  const y = toward[1] * (distance + radial) + east[1] * alongRa + north[1] * alongDec;
  const z = toward[2] * (distance + radial) + east[2] * alongRa + north[2] * alongDec;
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}
