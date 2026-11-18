/**
 * The wave's journey to Earth (#833): 1.3 billion years crossing space, told in seconds, then
 * its last 60-odd milliseconds as it sweeps across Earth, slowed, Livingston first and Hanford
 * 6.9 ms later.
 *
 * Which way it came: the paper places GW150914 in a wide band of the southern sky, not at a
 * point. Two detectors fix only the angle between the wave's path and the line between them
 * (6.9 ms of a possible 10.0): any direction on that cone fits. The one drawn is the cone's most
 * southern, a stand-in for the band, and the stage says so.
 *
 * Positions are Earth-fixed (x to 0° longitude, z to the north pole), in Earth radii.
 *
 * Pure: no DOM, no three.js.
 */

import { DETECTOR_SITES } from './detectorRig';
import type { Triple } from './strain';

/** Light's speed, km/s, and Earth's mean radius, km. */
const LIGHT = 299_792.458;
const EARTH_KM = 6371;
/** How much later Hanford heard it than Livingston, s (Abbott et al. 2016). */
export const DELAY = 0.0069;
/** How far the wave came, light-years: 410 Mpc, about 1.3 billion. */
const LIGHT_YEARS = 1.3e9;

/** A place on a round Earth, Earth-fixed, in Earth radii. */
export function earthFixed(latitude: number, longitude: number): Triple {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

export const LIVINGSTON = earthFixed(DETECTOR_SITES.L1.latitude, DETECTOR_SITES.L1.longitude);
export const HANFORD = earthFixed(DETECTOR_SITES.H1.latitude, DETECTOR_SITES.H1.longitude);

function dot(a: Triple, b: Triple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function unit(a: Triple): Triple {
  const length = Math.hypot(...a);
  return [a[0] / length, a[1] / length, a[2] / length];
}

/** The time, s, for a wave going along `k` to get from one place to another (Earth radii). */
export function delayBetween(k: Triple, from: Triple, to: Triple): number {
  return (dot(k, [to[0] - from[0], to[1] - from[1], to[2] - from[2]]) * EARTH_KM) / LIGHT;
}

/**
 * The way the wave went (unit, Earth-fixed): reaching Hanford `delay` s after Livingston, and,
 * of every way that does, the one coming most from the south.
 */
export function arrivalDirection(delay = DELAY): Triple {
  const baseline: Triple = [
    HANFORD[0] - LIVINGSTON[0],
    HANFORD[1] - LIVINGSTON[1],
    HANFORD[2] - LIVINGSTON[2],
  ];
  const length = Math.hypot(...baseline);
  const b = unit(baseline);
  const cosine = (delay * LIGHT) / (length * EARTH_KM);
  if (Math.abs(cosine) > 1) throw new Error('no direction gives that delay');
  // Across the baseline, toward the north: a wave from the south travels north.
  const north: Triple = [-b[2] * b[0], -b[2] * b[1], 1 - b[2] * b[2]];
  const u = unit(north);
  const sine = Math.sqrt(1 - cosine * cosine);
  return [cosine * b[0] + sine * u[0], cosine * b[1] + sine * u[1], cosine * b[2] + sine * u[2]];
}

/** The journey's parts, ms on screen: crossing space, sweeping Earth, then a rest. */
export const JOURNEY_MS = { travel: 7000, arrive: 6000, rest: 1800 } as const;
const TOTAL = JOURNEY_MS.travel + JOURNEY_MS.arrive + JOURNEY_MS.rest;
/** The stretch of the wave's path drawn as it sweeps Earth, Earth radii either side of its
 * middle: about 64 ms of its travel, played over `JOURNEY_MS.arrive`. */
const SWEEP = 1.6;

export interface JourneyMoment {
  readonly phase: 'travel' | 'arrive' | 'rest';
  /** Years still to go, while it travels. */
  readonly yearsToGo: number;
  /** Where the front is along its path, Earth radii from Earth's middle: negative before it. */
  readonly front: number;
  /** The time, s after 09:50:45 UTC, while it sweeps Earth. */
  readonly utc: number | null;
}

/** How long the journey plays, ms. */
export function journeyMs(): number {
  return TOTAL;
}

/**
 * Where the journey is `ms` into it: crossing space, years counting down as the front comes in
 * from far off (not to scale); then sweeping Earth, slowed, the UTC time to the millisecond,
 * timed so the front reaches Livingston at `atLivingston` s after 09:50:45.
 */
export function journeyAt(ms: number, atLivingston: number, k = arrivalDirection()): JourneyMoment {
  const into = Math.min(Math.max(ms, 0), TOTAL);
  if (into < JOURNEY_MS.travel) {
    const share = into / JOURNEY_MS.travel;
    // Counted down on a log scale, so each power of ten gets its share of the time.
    const yearsToGo = LIGHT_YEARS ** (1 - share) - 1;
    return { phase: 'travel', yearsToGo, front: -SWEEP - 7 * (1 - share) ** 2, utc: null };
  }
  const sweep = Math.min(1, (into - JOURNEY_MS.travel) / JOURNEY_MS.arrive);
  const front = -SWEEP + 2 * SWEEP * sweep;
  const reach = dot(k, LIVINGSTON);
  const utc = atLivingston + ((front - reach) * EARTH_KM) / LIGHT;
  return {
    phase: into < JOURNEY_MS.travel + JOURNEY_MS.arrive ? 'arrive' : 'rest',
    yearsToGo: 0,
    front,
    utc,
  };
}

/** Whether the front has passed a place yet. */
export function reached(moment: JourneyMoment, place: Triple, k = arrivalDirection()): boolean {
  return moment.phase !== 'travel' && moment.front >= dot(k, place);
}

/** Years as words: "870 million years to go". */
function years(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)} billion`;
  if (value >= 1e6) return `${Math.round(value / 1e6).toLocaleString('en-GB')} million`;
  if (value >= 1e3) return `${Math.round(value / 1e3).toLocaleString('en-GB')} thousand`;
  return Math.max(0, Math.round(value)).toLocaleString('en-GB');
}

/** The journey in words, at a moment. */
export function journeyText(moment: JourneyMoment, k = arrivalDirection()): string {
  if (moment.phase === 'travel') {
    return `Crossing space at the speed of light: ${years(moment.yearsToGo)} years to go`;
  }
  const clock = `09:50:${(45 + (moment.utc ?? 0)).toFixed(3).padStart(6, '0')} UTC`;
  if (reached(moment, HANFORD, k)) return `${clock} · Hanford hears it, 6.9 ms after Livingston`;
  if (reached(moment, LIVINGSTON, k)) return `${clock} · Livingston hears it first`;
  return `${clock} · reaching Earth`;
}
