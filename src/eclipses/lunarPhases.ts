/**
 * How long each phase of a lunar eclipse lasts, and which phase is happening at a moment.
 *
 * Meeus, *Astronomical Algorithms* ch. 54: in Earth radii at the Moon's distance, the
 * penumbra's radius is 1.2848 + u and the umbra's 0.7403 − u (u ≈ 0.0059 accounts for
 * Earth's atmosphere and flattening), the Moon's radius is 0.2725, and the Moon moves
 * relative to the shadow at about 0.5458 Earth radii per hour. That mean speed varies by
 * about ±7% with the Moon's distance, so durations are approximate (within ~10% of NASA's).
 */

import type { LunarEclipse } from '../data/lunarCatalog';

const U = 0.0059;
const MOON_RADIUS = 0.2725;
const PENUMBRA = 1.2848 + U;
const UMBRA = 0.7403 - U;
/** Earth radii per hour: the Moon's mean motion relative to Earth's shadow. */
const RELATIVE_SPEED = 0.5458;

export type LunarPhase = 'none' | 'penumbral' | 'partial' | 'total';

export interface LunarPhaseDurations {
  /** Half-durations in minutes, from greatest eclipse; 0 when the phase doesn't happen. */
  readonly penumbral: number;
  readonly partial: number;
  readonly total: number;
}

function semiDuration(radius: number, gamma: number): number {
  const chord = radius * radius - gamma * gamma;
  return chord <= 0 ? 0 : (Math.sqrt(chord) / RELATIVE_SPEED) * 60;
}

export function lunarSemiDurations(gamma: number): LunarPhaseDurations {
  return {
    penumbral: semiDuration(PENUMBRA + MOON_RADIUS, gamma),
    partial: semiDuration(UMBRA + MOON_RADIUS, gamma),
    total: semiDuration(UMBRA - MOON_RADIUS, gamma),
  };
}

/** The phase `offsetMinutes` from greatest eclipse. */
export function lunarPhaseAt(eclipse: LunarEclipse, offsetMinutes: number): LunarPhase {
  const semi = lunarSemiDurations(eclipse.gamma);
  const away = Math.abs(offsetMinutes);
  if (away < semi.total) return 'total';
  if (away < semi.partial) return 'partial';
  if (away < semi.penumbral) return 'penumbral';
  return 'none';
}

/** Degrees per hour the point under the Moon moves west: 360° per lunar day (24.8412 h). */
export const SUBLUNAR_DRIFT_DEGREES_PER_HOUR = 360 / 24.8412;
