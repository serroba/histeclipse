/**
 * Where the Moon is: ELP/MPP02 (Chapront & Francou 2003, via astronomia, MIT), with the secular
 * terms of the mean longitude refitted to JPL DE441 so the Moon agrees with the eclipse catalogs.
 *
 * ELP/MPP02 as published is fitted to DE405/DE406; DE441 differs from those by up to ~0.2° in
 * the remote past. Refitting the mean longitude's T², T³ and T⁴ terms (the method the authors
 * used for DE406) to 200 DE441 samples brings the remaining difference to under ~0.02° over
 * 4000 BCE–3000 CE, checked against an independent set of samples. The node and perigee terms
 * are folded into this data's series and are not refitted; their drift stays below ~0.025°.
 *
 * The series data is ~200 KB gzipped, so it loads on demand.
 */

import type { ElpData } from 'astronomia/elp';

import type { JulianDay } from '../time/julianDay';
import { secularCorrectionAt, type SecularCorrection } from './secularFit';

const J2000 = 2_451_545;
const DAYS_PER_CENTURY = 36_525;
const ARCSECOND = Math.PI / 180 / 3600;
/** IAU 2006 obliquity of the ecliptic at J2000. */
const OBLIQUITY_J2000 = 84_381.406 * ARCSECOND;

/** Correction to ELP/MPP02's mean longitude, fitted to DE441: arcseconds × (T², T³, T⁴). */
export const DE441_CORRECTION: SecularCorrection = [1.3025e-2, 3.7361e-3, 7.7918e-6];

/** Geocentric position in km, J2000 equator (≈ ICRF): x to the equinox, z to the pole. */
export type EquatorialVector = readonly [x: number, y: number, z: number];

export interface MoonEphemeris {
  /** The Moon's geometric geocentric position at a TT Julian Day. */
  position(jdTT: JulianDay): EquatorialVector;
}

/** ELP/MPP02 data with the mean longitude corrected by `correction`. */
export function correctedData(data: ElpData, correction: SecularCorrection): ElpData {
  const [t2, t3, t4] = correction;
  const offsets = [0, 0, t2, t3, t4];
  return { ...data, W1: data.W1.map((value, power) => value + (offsets[power] ?? 0) * ARCSECOND) };
}

export function eclipticToEquatorial(x: number, y: number, z: number): EquatorialVector {
  const cos = Math.cos(OBLIQUITY_J2000);
  const sin = Math.sin(OBLIQUITY_J2000);
  return [x, y * cos - z * sin, y * sin + z * cos];
}

export function createMoonEphemeris(
  data: ElpData,
  Moon: new (data: ElpData) => { positionXYZ(jde: number): { x: number; y: number; z: number } },
  correction: SecularCorrection = DE441_CORRECTION,
): MoonEphemeris {
  const theory = new Moon(correctedData(data, correction));
  return {
    position(jdTT) {
      const { x, y, z } = theory.positionXYZ(jdTT);
      return eclipticToEquatorial(x, y, z);
    },
  };
}

/** Load the lunar theory (a separate ~200 KB chunk) and return the corrected ephemeris. */
export async function loadMoonEphemeris(): Promise<MoonEphemeris> {
  const [{ Moon }, { default: data }] = await Promise.all([
    import('astronomia/elp'),
    import('astronomia/data/elpMppDe'),
  ]);
  return createMoonEphemeris(data, Moon);
}

/** Julian centuries from J2000 (TT). */
export function centuriesSinceJ2000(jdTT: number): number {
  return (jdTT - J2000) / DAYS_PER_CENTURY;
}

export { secularCorrectionAt };
