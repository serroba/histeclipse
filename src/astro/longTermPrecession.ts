/**
 * Precession valid for long time spans: Vondrák, Capitaine & Wallace (2011), "New precession
 * expressions, valid for long time intervals", A&A 534, A22, with the corrigendum in A&A 541,
 * C1 (2012). Fitted to numerical integrations over ±200,000 years, where the IAU 1976 and 2006
 * polynomials eventually drift away. Over this site's range the drift is small (tested below):
 * Earth's orientation from the IAU 1976 model is off by under 3′ at 3000 BCE.
 *
 * Coefficients and the matrix construction follow ERFA (`eraLtpecl`, `eraLtpequ`, `eraLtp`,
 * `eraEors`): Copyright (C) 2013-2023, NumFOCUS Foundation, BSD 3-Clause licence, derived with
 * permission from the IAU SOFA library. This is a port of ERFA, not SOFA itself. ERFA's full
 * licence, which covers these coefficients and algorithms, is in licenses/ERFA.txt.
 *
 * Sidereal time comes from the Earth Rotation Angle, which is linear in UT1 by definition, and
 * the equation of the origins, which follows from the precession itself. Polynomials for sidereal
 * time (IAU 1982, 2006) are only fitted for a few centuries either side of J2000.
 */

import type { JulianDay } from '../time/julianDay';
import { rotationZ, multiply, transpose, type Matrix3, type Vector3 } from './matrix';

const J2000 = 2_451_545;
const ARCSECOND = Math.PI / 180 / 3600;
/** Obliquity at J2000 (IAU 2006), for the ecliptic pole's frame. */
const OBLIQUITY_J2000 = 84_381.406 * ARCSECOND;

/** Period (centuries), then cos and sin coefficients (″) for P_A, Q_A: [period, cP, cQ, sP, sQ]. */
const ECLIPTIC_PERIODIC: readonly (readonly [number, number, number, number, number])[] = [
  [708.15, -5486.751211, -684.66156, 667.66673, -5523.863691],
  [2309.0, -17.127623, 2446.28388, -2354.886252, -549.74745],
  [1620.0, -617.517403, 399.671049, -428.152441, -310.998056],
  [492.2, 413.44294, -356.652376, 376.202861, 421.535876],
  [1183.0, 78.614193, -186.387003, 184.778874, -36.776172],
  [622.0, -180.732815, -316.80007, 335.321713, -145.278396],
  [882.0, -87.676083, 198.296701, -185.138669, -34.74445],
  [547.0, 46.140315, 101.135679, -120.97283, 22.885731],
];
/** Cubic coefficients (″) for P_A and Q_A, by power of t. */
const ECLIPTIC_POLYNOMIAL: readonly (readonly [number, number])[] = [
  [5851.607687, -1600.8863],
  [-0.1189, 1.1689818],
  [-0.00028913, -0.0000002],
  [0.000000101, -0.000000437],
];

/** Period (centuries), then cos and sin coefficients (″) for X, Y: [period, cX, cY, sX, sY]. */
const EQUATOR_PERIODIC: readonly (readonly [number, number, number, number, number])[] = [
  [256.75, -819.940624, 75004.344875, 81491.287984, 1558.515853],
  [708.15, -8444.676815, 624.033993, 787.163481, 7774.939698],
  [274.2, 2600.009459, 1251.136893, 1251.296102, -2219.534038],
  [241.45, 2755.17563, -1102.212834, -1257.950837, -2523.969396],
  [2309.0, -167.659835, -2660.66498, -2966.79973, 247.850422],
  [492.2, 871.855056, 699.291817, 639.744522, -846.485643],
  [396.1, 44.769698, 153.16722, 131.600209, -1393.124055],
  [288.9, -512.313065, -950.865637, -445.040117, 368.526116],
  [231.1, -819.415595, 499.754645, 584.522874, 749.045012],
  [1610.0, -538.071099, -145.18821, -89.756563, 444.704518],
  [620.0, -189.793622, 558.116553, 524.42963, 235.934465],
  [157.87, -402.922932, -23.923029, -13.549067, 374.049623],
  [220.3, 179.516345, -165.405086, -210.157124, -171.33018],
  [1200.0, -9.814756, 9.344131, -44.919798, -22.899655],
];
/** Cubic coefficients (″) for X and Y, by power of t. */
const EQUATOR_POLYNOMIAL: readonly (readonly [number, number])[] = [
  [5453.282155, -73750.93035],
  [0.4252841, -0.7675452],
  [-0.00037173, -0.00018725],
  [-0.000000152, 0.000000231],
];

/** Julian centuries (TT) since J2000. */
function centuries(jdTT: JulianDay): number {
  return (jdTT - J2000) / 36_525;
}

/**
 * A pair of series in arcseconds and their rates (″ per century) at `t` centuries: the
 * periodic terms plus a cubic.
 */
function series(
  t: number,
  periodic: readonly (readonly [number, number, number, number, number])[],
  polynomial: readonly (readonly [number, number])[],
): { a: number; b: number; aRate: number; bRate: number } {
  let a = 0;
  let b = 0;
  let aRate = 0;
  let bRate = 0;
  for (const [period, cosA, cosB, sinA, sinB] of periodic) {
    const frequency = (2 * Math.PI) / period;
    const s = Math.sin(frequency * t);
    const c = Math.cos(frequency * t);
    a += c * cosA + s * sinA;
    b += c * cosB + s * sinB;
    aRate += frequency * (c * sinA - s * cosA);
    bRate += frequency * (c * sinB - s * cosB);
  }
  for (const [power, [coefficientA, coefficientB]] of polynomial.entries()) {
    a += coefficientA * t ** power;
    b += coefficientB * t ** power;
    // The constant term has no rate; t ** -1 would be infinite at J2000.
    const rate = power === 0 ? 0 : power * t ** (power - 1);
    aRate += coefficientA * rate;
    bRate += coefficientB * rate;
  }
  return { a, b, aRate, bRate };
}

/** The mean ecliptic pole of date, as a unit vector in the J2000 equatorial frame. */
export function eclipticPole(jdTT: JulianDay): Vector3 {
  const { a, b } = series(centuries(jdTT), ECLIPTIC_PERIODIC, ECLIPTIC_POLYNOMIAL);
  const pa = a * ARCSECOND;
  const qa = b * ARCSECOND;
  const w = Math.sqrt(Math.max(0, 1 - pa * pa - qa * qa));
  const s = Math.sin(OBLIQUITY_J2000);
  const c = Math.cos(OBLIQUITY_J2000);
  return [pa, -qa * c - w * s, -qa * s + w * c];
}

/** The mean equator pole (X, Y in radians) of date and its rate (radians per century). */
function equatorPoleAndRate(t: number): { x: number; y: number; xRate: number; yRate: number } {
  const { a, b, aRate, bRate } = series(t, EQUATOR_PERIODIC, EQUATOR_POLYNOMIAL);
  return { x: a * ARCSECOND, y: b * ARCSECOND, xRate: aRate * ARCSECOND, yRate: bRate * ARCSECOND };
}

/** The mean equator pole of date, as a unit vector in the J2000 equatorial frame. */
export function equatorPole(jdTT: JulianDay): Vector3 {
  const { x, y } = equatorPoleAndRate(centuries(jdTT));
  return [x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))];
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Matrix taking J2000 mean equatorial vectors to the mean equator and equinox of `jdTT`. */
export function longTermPrecessionMatrix(jdTT: JulianDay): Matrix3 {
  const pole = equatorPole(jdTT);
  const [ex, ey, ez] = cross(pole, eclipticPole(jdTT));
  const length = Math.hypot(ex, ey, ez);
  const equinox: Vector3 = [ex / length, ey / length, ez / length];
  return [equinox, cross(pole, equinox), pole];
}

/**
 * The CIO locator s (radians): how far the Celestial Intermediate Origin has slid along the
 * equator since J2000, from its defining integral s = −∫ (X dY − Y dX) / (1 + Z). The pole
 * here is the mean one; nutation would add a few hundredths of an arcsecond.
 */
export function cioLocator(jdTT: JulianDay): number {
  const t = centuries(jdTT);
  if (t === 0) return 0;
  // Simpson's rule; the shortest period is 158 centuries, so eight steps a century is ample.
  const steps = 2 * Math.max(4, Math.ceil(Math.abs(t) * 4));
  const h = t / steps;
  let sum = 0;
  for (let i = 0; i <= steps; i++) {
    const { x, y, xRate, yRate } = equatorPoleAndRate(i * h);
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    const weight = i === 0 || i === steps ? 1 : i % 2 === 1 ? 4 : 2;
    sum += (weight * (x * yRate - y * xRate)) / (1 + z);
  }
  return -(sum * h) / 3;
}

/** The Earth Rotation Angle (radians, 0..2π) at UT1 (IAU 2000). */
export function earthRotationAngle(jdUT: JulianDay): number {
  const days = jdUT - J2000;
  // Whole days are whole turns of the 1.0027… factor's integer part; add the fraction apart.
  const turns = 0.779_057_273_264 + 0.002_737_811_911_354_48 * days + (days % 1);
  return 2 * Math.PI * (turns - Math.floor(turns));
}

/**
 * Equation of the origins (radians) for a precession matrix and CIO locator: the angle from
 * the equinox to the CIO along the equator (ERFA `eraEors`).
 */
function equationOfOrigins(precession: Matrix3, s: number): number {
  const [row0, row1, row2] = precession;
  const x = row2[0];
  const ax = x / (1 + row2[2]);
  const xs = 1 - ax * x;
  const ys = -ax * row2[1];
  const zs = -x;
  const p = row0[0] * xs + row0[1] * ys + row0[2] * zs;
  const q = row1[0] * xs + row1[1] * ys + row1[2] * zs;
  return s - Math.atan2(q, p);
}

/** Greenwich mean sidereal time (radians, 0..2π): the Earth Rotation Angle less the EO. */
export function longTermMeanSiderealTime(jdUT: JulianDay, jdTT: JulianDay): number {
  const angle =
    earthRotationAngle(jdUT) - equationOfOrigins(longTermPrecessionMatrix(jdTT), cioLocator(jdTT));
  const turn = 2 * Math.PI;
  return ((angle % turn) + turn) % turn;
}

/**
 * Matrix taking Earth-fixed vectors (x through Greenwich, z through the North Pole) to the
 * J2000 equatorial frame, valid for millennia: spin by sidereal time, then undo precession.
 * Nutation (< 20″) and polar motion are left out.
 */
export function longTermEarthFixedToJ2000(jdUT: JulianDay, jdTT: JulianDay): Matrix3 {
  return multiply(
    transpose(longTermPrecessionMatrix(jdTT)),
    rotationZ(longTermMeanSiderealTime(jdUT, jdTT)),
  );
}
