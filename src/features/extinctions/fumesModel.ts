/**
 * The Siberian Traps' fumes (#1192), as an illustration, not a model: vents scattered over the
 * traps, each puffing gas that rises, spreads and drifts east as it thins, and a haze over the
 * globe. How strongly they fume follows the studies' timeline on the crisis clock, seconds since
 * the extinction began: the flood lavas from some 300,000 years before (Burgess & Bowring 2015),
 * the sills baking coal and evaporites from its start, the deadliest gas (Burgess, Muirhead &
 * Bowring 2017; Svensen et al. 2009), and the eruptions going on, waning, for some 500,000 years
 * after. The heights, sizes and haze are drawn to be seen, not to scale.
 *
 * Pure.
 */

import type { GeoPoint } from '../../core/geo';
import { clamp01 } from '../../util/timing';

const YEAR = 365.25 * 86_400;
const KYR = 1000 * YEAR;

/** How strongly the traps fume at a moment, each 0 to 1. */
export interface Fuming {
  /** The flood lavas' plumes, pale. */
  readonly lava: number;
  /** The sills' gas, dark: carbon dioxide, methane, halocarbons, sulfur. */
  readonly gas: number;
  /** The haze spread over the globe. */
  readonly haze: number;
}

/** Rising from 0 at `from` to 1 at `to`, seconds; falling if `to` is before `from`. */
function ramp(seconds: number, from: number, to: number): number {
  return clamp01((seconds - from) / (to - from));
}

/** How strongly the traps fume `seconds` after the extinction began. */
export function fumingAt(seconds: number): Fuming {
  // The lavas: from 300 kyr before, on through the extinction, waning to none 600 kyr after.
  const lava = ramp(seconds, -300 * KYR, -290 * KYR) * ramp(seconds, 600 * KYR, 100 * KYR);
  // The sills: from just before its start, through the 60 kyr it took, gone by 200 kyr.
  const gas = ramp(seconds, -10 * KYR, 0) * ramp(seconds, 200 * KYR, 60 * KYR);
  // The haze builds with the gas and lingers after it.
  const haze = Math.max(
    0.25 * lava,
    ramp(seconds, -5 * KYR, 20 * KYR) * ramp(seconds, 400 * KYR, 80 * KYR),
  );
  return { lava, gas, haze };
}

/** Degrees of the traps' spread from their centre: they cover millions of square kilometres. */
const SPREAD_DEGREES = 9;

/**
 * Where `count` vents lie round `center`: scattered over a disc by the golden angle, so they fill
 * it evenly without a pattern, the same each time.
 */
export function ventsAround(center: GeoPoint, count: number): GeoPoint[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const cos = Math.cos((center.latitude * Math.PI) / 180);
  return Array.from({ length: count }, (_, index) => {
    const out = SPREAD_DEGREES * Math.sqrt((index + 0.5) / count);
    const turn = index * golden;
    return {
      latitude: center.latitude + out * Math.sin(turn),
      longitude: center.longitude + (out * Math.cos(turn)) / Math.max(0.2, cos),
    };
  });
}

/** A puff of a plume: how high, how far east, how wide (Earth radii) and how opaque. */
export interface Puff {
  readonly height: number;
  readonly east: number;
  readonly size: number;
  readonly opacity: number;
}

/** How high a plume rises, Earth radii: drawn to be seen from orbit, not to scale. */
const RISE = 0.08;
/** How far east it drifts as it rises, Earth radii: the wind carries the ash downwind. */
const DRIFT = 0.12;

/**
 * Puff `index` of `count` on a plume whose cycle is at `cycle` (0 to 1, going round), fuming
 * `strength` (0 to 1): each rises, widens and drifts east, fading as it goes.
 */
export function puffAt(index: number, count: number, cycle: number, strength: number): Puff {
  const age = (((cycle + index / count) % 1) + 1) % 1;
  return {
    height: 0.004 + RISE * age,
    east: DRIFT * age * age,
    size: 0.03 + 0.13 * age,
    opacity: 0.85 * strength * Math.sin(Math.PI * Math.min(1, 1.6 * age + 0.1)) ** 0.6 * (1 - age),
  };
}
