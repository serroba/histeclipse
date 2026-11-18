/**
 * The wave's journey to Earth (#833, #841): 1.3 billion years crossing space, told in seconds,
 * then its loudest tenth of a second sweeping across Earth, 100 times slower, Livingston first
 * and Hanford 6.9 ms later. So far from its source the wave is a plane wave: flat wavefronts
 * across its path, a wavelength apart (about 3,000 km at 100 Hz, half Earth's radius), so
 * several crests cross Earth at once. Each place meets the wave as Livingston did, earlier or
 * later by how far along the path it lies.
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
import type { Polarisations, Triple, Waveform } from './strain';

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

/**
 * The wave's own time while it arrives, s from when the merger's wave reaches Livingston: from
 * when its loud part is near, to the ringing's end. Played 100 times slower, as the other
 * chapters are, so the crests can be followed across Earth.
 */
const ARRIVE_FROM = -0.11;
const ARRIVE_TO = 0.035;
const SLOWED = 100;
/** While it travels, the wave's own time runs on by this much, s: from before its first part
 * (0.17 s before the merger) is within 3 Earth radii of Earth, so Earth is at rest while the
 * years count down, to its leading part sweeping in as they end. */
const APPROACH = 0.13;

/** The journey's parts, ms on screen: crossing space, sweeping Earth, then a rest. */
export const JOURNEY_MS = {
  travel: 6000,
  arrive: (ARRIVE_TO - ARRIVE_FROM) * SLOWED * 1000,
  rest: 1500,
} as const;
const TOTAL = JOURNEY_MS.travel + JOURNEY_MS.arrive + JOURNEY_MS.rest;

export interface JourneyMoment {
  readonly phase: 'travel' | 'arrive' | 'rest';
  /** Years still to go, while it travels. */
  readonly yearsToGo: number;
  /** The wave's own time, s from when the merger's wave reached Livingston. */
  readonly waveTime: number;
  /** The time, s after 09:50:45 UTC, once it is at Earth. */
  readonly utc: number | null;
}

/** How long the journey plays, ms. */
export function journeyMs(): number {
  return TOTAL;
}

/**
 * Where the journey is `ms` into it: crossing space, years counting down as its leading part
 * comes in; then sweeping Earth, 100 times slower, the UTC time to the millisecond, the merger's
 * wave reaching Livingston at `atLivingston` s after 09:50:45.
 */
export function journeyAt(ms: number, atLivingston: number): JourneyMoment {
  const into = Math.min(Math.max(ms, 0), TOTAL);
  if (into < JOURNEY_MS.travel) {
    const share = into / JOURNEY_MS.travel;
    // Counted down on a log scale, so each power of ten gets its share of the time.
    const yearsToGo = LIGHT_YEARS ** (1 - share) - 1;
    return {
      phase: 'travel',
      yearsToGo,
      waveTime: ARRIVE_FROM - APPROACH * (1 - share),
      utc: null,
    };
  }
  const waveTime = Math.min(ARRIVE_TO, ARRIVE_FROM + (into - JOURNEY_MS.travel) / (1000 * SLOWED));
  return {
    phase: into < JOURNEY_MS.travel + JOURNEY_MS.arrive ? 'arrive' : 'rest',
    yearsToGo: 0,
    waveTime,
    utc: atLivingston + waveTime,
  };
}

/** How much later than Livingston the wave reaches a place, s (Earth radii, Earth-fixed). */
export function laterThanLivingston(place: Triple, k = arrivalDirection()): number {
  return delayBetween(k, LIVINGSTON, place);
}

/** Whether the merger's wave has reached a place yet. */
export function reached(moment: JourneyMoment, place: Triple, k = arrivalDirection()): boolean {
  return moment.phase !== 'travel' && moment.waveTime >= laterThanLivingston(place, k);
}

/** How the wave along the path is laid out: values per place (2, or 4 for a texture's RGBA),
 * and how much each is stretched. */
export interface PathLayout {
  readonly stride: number;
  readonly scale: number;
}

/**
 * The wave along its path about Earth at a moment: at each of `bins` places from `from` to `to`
 * Earth radii along the way it goes (0 at Earth's middle), the h₊ and h× it then has, as it was
 * when it reached Livingston that much earlier or later; nearest the source first, each pair
 * `stride` apart and times `scale`.
 */
export function pathTable(
  wave: Waveform,
  waveTime: number,
  span: { readonly from: number; readonly to: number; readonly bins: number },
  k = arrivalDirection(),
  layout: PathLayout = { stride: 2, scale: 1 },
): Float32Array {
  const table = new Float32Array(span.bins * layout.stride);
  const atLivingston = dot(k, LIVINGSTON);
  for (let index = 0; index < span.bins; index += 1) {
    const along = span.from + ((span.to - span.from) * index) / (span.bins - 1);
    const { plus, cross } = wave.at(waveTime - ((along - atLivingston) * EARTH_KM) / LIGHT);
    table[layout.stride * index] = plus * layout.scale;
    table[layout.stride * index + 1] = cross * layout.scale;
  }
  return table;
}

/** The pair at `index` of a table laid out `stride` apart; none past its ends. */
export function pairAt(table: Float32Array, index: number, stride: number): Polarisations {
  return { plus: table[stride * index] ?? 0, cross: table[stride * index + 1] ?? 0 };
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
