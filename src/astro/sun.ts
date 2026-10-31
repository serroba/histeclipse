/**
 * Where the Sun is, from analytic formulas fast enough to run every frame.
 *
 * Meeus, *Astronomical Algorithms* (2nd ed.): the Sun from ch. 25 (low accuracy), nutation
 * from ch. 22 (low accuracy), sidereal time from ch. 12. Tested against JPL DE441 via
 * `test-vectors/sun.json` over 4000 BCE to 3000 CE.
 */

import type { JulianDay } from '../time/julianDay';

const J2000 = 2_451_545;
const DAYS_PER_CENTURY = 36_525;
const RADIANS = Math.PI / 180;
const ARCSECOND = 1 / 3600;

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface EquatorialPosition {
  /** Degrees, 0 to 360, referred to the true equinox of date. */
  readonly rightAscension: number;
  /** Degrees. */
  readonly declination: number;
}

/** Julian centuries since J2000. */
function centuries(jd: number): number {
  return (jd - J2000) / DAYS_PER_CENTURY;
}

function normalizeDegrees(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function normalizeLongitude(angle: number): number {
  const wrapped = normalizeDegrees(angle);
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

/** Nutation in longitude and true obliquity of the ecliptic, in degrees (Meeus ch. 22). */
export function nutationAndObliquity(jdTT: JulianDay): {
  readonly nutationInLongitude: number;
  readonly trueObliquity: number;
} {
  const t = centuries(jdTT);
  const moonNode = (125.04452 - 1934.136261 * t) * RADIANS;
  const sunLongitude = (280.4665 + 36_000.7698 * t) * RADIANS;
  const moonLongitude = (218.3165 + 481_267.8813 * t) * RADIANS;
  const nutationInLongitude =
    (-17.2 * Math.sin(moonNode) -
      1.32 * Math.sin(2 * sunLongitude) -
      0.23 * Math.sin(2 * moonLongitude) +
      0.21 * Math.sin(2 * moonNode)) *
    ARCSECOND;
  const nutationInObliquity =
    (9.2 * Math.cos(moonNode) +
      0.57 * Math.cos(2 * sunLongitude) +
      0.1 * Math.cos(2 * moonLongitude) -
      0.09 * Math.cos(2 * moonNode)) *
    ARCSECOND;
  const meanObliquity =
    23 + 26 / 60 + (21.448 - 46.815 * t - 0.00059 * t * t + 0.001813 * t * t * t) * ARCSECOND;
  return { nutationInLongitude, trueObliquity: meanObliquity + nutationInObliquity };
}

/** Apparent geocentric right ascension and declination of the Sun (Meeus ch. 25). */
export function sunPosition(jdTT: JulianDay): EquatorialPosition {
  const t = centuries(jdTT);
  const meanLongitude = 280.46646 + 36_000.76983 * t + 0.0003032 * t * t;
  const meanAnomaly = (357.52911 + 35_999.05029 * t - 0.0001537 * t * t) * RADIANS;
  const equationOfCenter =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(meanAnomaly) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * meanAnomaly) +
    0.000289 * Math.sin(3 * meanAnomaly);
  const { nutationInLongitude, trueObliquity } = nutationAndObliquity(jdTT);
  // True longitude, plus nutation, minus aberration (20.4898″ for the mean Earth-Sun distance).
  const longitude =
    (meanLongitude + equationOfCenter + nutationInLongitude - 20.4898 * ARCSECOND) * RADIANS;
  const obliquity = trueObliquity * RADIANS;
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude));
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(longitude));
  return {
    rightAscension: normalizeDegrees(rightAscension / RADIANS),
    declination: declination / RADIANS,
  };
}

/** Greenwich mean sidereal time in degrees, from UT (Meeus eq. 12.4). */
export function greenwichMeanSiderealTime(jdUT: JulianDay): number {
  const t = centuries(jdUT);
  return normalizeDegrees(
    280.46061837 +
      360.98564736629 * (jdUT - J2000) +
      0.000387933 * t * t -
      (t * t * t) / 38_710_000,
  );
}

/** Greenwich apparent sidereal time in degrees: mean time plus the equation of the equinoxes. */
export function greenwichApparentSiderealTime(jdUT: JulianDay, jdTT: JulianDay): number {
  const { nutationInLongitude, trueObliquity } = nutationAndObliquity(jdTT);
  return normalizeDegrees(
    greenwichMeanSiderealTime(jdUT) + nutationInLongitude * Math.cos(trueObliquity * RADIANS),
  );
}

/** Where on Earth the Sun is overhead. Needs both time scales: TT for the Sun, UT for Earth. */
export function subsolarPoint(jdUT: JulianDay, jdTT: JulianDay): GeoPoint {
  const sun = sunPosition(jdTT);
  return {
    latitude: sun.declination,
    longitude: normalizeLongitude(sun.rightAscension - greenwichApparentSiderealTime(jdUT, jdTT)),
  };
}
