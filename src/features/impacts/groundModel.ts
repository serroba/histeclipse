/**
 * What the ground shows round a strike at a moment of the strike clock (#1175, #1176): the
 * crater forming in its first minutes, the ejecta blanket spreading over the land, and the
 * tsunami crossing the sea. Drawn by the strike-ground part of the Earth shader
 * (`strikeGroundPart.ts`), close up for the crater and from middle distance for the rest.
 *
 * Chicxulub's own sizes and times: a transient cavity about 100 km wide within tens of seconds,
 * collapsing within minutes into a ring of peaks inside a crater about 200 km across (Gulick et
 * al. 2019; Morgan et al. 2016, whose simulation runs 0, 1, 3, 4, 5 and 10 minutes). The peak
 * ring's place inside the rim is illustrative. The blanket thins as the cube of distance
 * (McGetchin, Settle & Head 1973). The tsunami's crest travels at the speed of a shallow-water
 * wave over a 4 km deep ocean, √(gh): an assumption of the drawing (Range et al. 2022 modelled
 * the real one).
 *
 * Pure.
 */

import { clamp01 } from '../../util/timing';

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86_400;
const YEAR = 365.25 * DAY;
export const EARTH_KM = 6371;

/** The transient cavity's radius, km, and the final crater's. */
export const CAVITY_KM = 50;
export const RIM_KM = 100;
/** The speed of a shallow-water wave over a 4 km deep ocean, km a second: √(9.8 × 4000) m/s. */
export const TSUNAMI_KM_S = Math.sqrt(9.8 * 4000) / 1000;

export interface StrikeGround {
  /** The hole's radius, km, and how deep it reads, 0 to 1. */
  readonly cavityKm: number;
  readonly depth: number;
  /** The central uplift, 0 to 1, risen and fallen. */
  readonly uplift: number;
  /** The ring of peaks and the final rim, 0 to 1 as they form. */
  readonly peakRing: number;
  readonly rim: number;
  /** How far the ejecta blanket has reached, radians from the crater, and how plain it is. */
  readonly blanketReach: number;
  readonly blanket: number;
  /** The tsunami's leading crest, radians from the crater, and how strong it reads. */
  readonly tsunamiFront: number;
  readonly tsunami: number;
}

/** How far through, 0 to 1, `t` is between `from` and `to`. */
function through(t: number, from: number, to: number): number {
  return clamp01((t - from) / (to - from));
}

/** How far through, 0 to 1, `t` is between `from` and `to` seconds, on a log scale. */
function logThrough(t: number, from: number, to: number): number {
  if (t <= from) return 0;
  return clamp01(Math.log(t / from) / Math.log(to / from));
}

/** The ground `seconds` after the strike, for an impact reaching `worldwide` of the way round. */
export function strikeGround(seconds: number, worldwide: number): StrikeGround {
  const t = Math.max(0, seconds);
  if (seconds <= 0) {
    return {
      cavityKm: 0,
      depth: 0,
      uplift: 0,
      peakRing: 0,
      rim: 0,
      blanketReach: 0,
      blanket: 0,
      tsunamiFront: 0,
      tsunami: 0,
    };
  }
  // The cavity opens within tens of seconds, then widens and shallows as it collapses.
  const opening = 1 - Math.exp(-t / 8);
  const collapsing = through(t, MINUTE, 10 * MINUTE);
  // The uplift rises over the first three minutes and falls outward over the next two.
  const rising = through(t, MINUTE, 3 * MINUTE);
  const falling = through(t, 3 * MINUTE, 5 * MINUTE);
  // The ejecta land near the crater within minutes and round the globe within hours.
  const near = logThrough(t, MINUTE, 15 * MINUTE) * ((3 * RIM_KM) / EARTH_KM);
  const far = Math.PI * worldwide * logThrough(t, 15 * MINUTE, 8 * HOUR);
  return {
    cavityKm: CAVITY_KM * opening + (RIM_KM - CAVITY_KM) * collapsing,
    depth: opening * (1 - 0.85 * collapsing),
    uplift: rising * (1 - falling),
    peakRing: through(t, 3 * MINUTE, 10 * MINUTE),
    rim: through(t, 3 * MINUTE, 10 * MINUTE),
    blanketReach: Math.max(near, far),
    // In the drawing it fades as later sediment buries it, over the ages after.
    blanket: 1 - logThrough(t, 1000 * YEAR, 100_000 * YEAR),
    tsunamiFront: Math.min(Math.PI, (TSUNAMI_KM_S * t) / EARTH_KM),
    // Its waves die down over days.
    tsunami: logThrough(t, 30, 5 * MINUTE) * (1 - logThrough(t, DAY, 4 * DAY)),
  };
}
