/**
 * A wave's journey to Earth (#833, #841, #993), from its trip (`trips.ts`): GW150914's 1.3
 * billion years crossing space, or GW170817's 130 million, told in seconds; then its loudest part
 * sweeping across Earth, 100 times slower, each detector hearing it in turn: GW150914 at
 * Livingston, then Hanford 6.9 ms later; GW170817 at Virgo, Livingston and Hanford. So far from its source the wave is a plane wave: flat wavefronts
 * across its path, a wavelength apart (about 3,000 km at 100 Hz, half Earth's radius), so
 * several crests cross Earth at once. Each place meets the wave as Livingston did, earlier or
 * later by how far along the path it lies.
 *
 * Which way it came: the paper places GW150914 in a wide band of the southern sky, not at a
 * point. Two detectors fix only the angle between the wave's path and the line between them
 * (6.9 ms of a possible 10.0): any direction on that cone fits. The one drawn is the cone's most
 * southern, a stand-in for the band, and the stage says so. GW170817's host galaxy was found,
 * so its way is known: from where its source stood in the sky at the merger, turned into
 * Earth-fixed axes by Greenwich sidereal time.
 *
 * Positions are Earth-fixed (x to 0° longitude, z to the north pole), in Earth radii.
 *
 * Pure: no DOM, no three.js.
 */

import type { Polarisations, Triple, Waveform } from './strain';
import { GW150914_TRIP, SITES, type DetectorId, type Trip } from './trips';

/** Light's speed, km/s, and Earth's mean radius, km. */
const LIGHT = 299_792.458;
const EARTH_KM = 6371;
/** How much later Hanford heard GW150914 than Livingston, s (Abbott et al. 2016). */
export const DELAY = GW150914_TRIP.delay;

/** A place on a round Earth, Earth-fixed, in Earth radii. */
export function earthFixed(latitude: number, longitude: number): Triple {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

/** Where a detector stands, Earth-fixed. */
export function placeOf(detector: DetectorId): Triple {
  return earthFixed(SITES[detector].latitude, SITES[detector].longitude);
}

export const LIVINGSTON = placeOf('L1');
export const HANFORD = placeOf('H1');

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

/** Greenwich mean sidereal time at `date`, degrees (IAU 1982, as Meeus gives it). */
export function siderealDegrees(date: Date): number {
  const days = date.getTime() / 86_400_000 + 2_440_587.5 - 2_451_545;
  const centuries = days / 36_525;
  const degrees = 280.460_618_37 + 360.985_647_366_29 * days + 0.000_387_933 * centuries ** 2;
  return ((degrees % 360) + 360) % 360;
}

/** The way a wave from a source at right ascension and declination (degrees) went, Earth-fixed,
 * at `date`: away from the point on Earth the source stood over. */
export function directionFrom(rightAscension: number, declination: number, date: Date): Triple {
  const over = earthFixed(declination, rightAscension - siderealDegrees(date));
  return [-over[0], -over[1], -over[2]];
}

const DIRECTIONS = new WeakMap<Trip, Triple>();

/** The way a trip's wave went: from its source if known, else the cone's most southern way. */
export function directionOf(trip: Trip): Triple {
  const known = DIRECTIONS.get(trip);
  if (known !== undefined) return known;
  const { source } = trip;
  const way =
    source === null
      ? arrivalDirection(trip.delay)
      : directionFrom(source.rightAscension, source.declination, new Date(source.utc));
  DIRECTIONS.set(trip, way);
  return way;
}

/**
 * The wave's own time while it arrives, s from when the merger's wave reaches Livingston: from
 * when its loud part is near, to the ringing's end. Played 100 times slower, as the other
 * chapters are, so the crests can be followed across Earth.
 */
const SLOWED = 100;

/** A journey's parts, ms on screen: crossing space, sweeping Earth, then a rest, longer when
 * there is something to say after. While it travels, the wave's own time runs on by its window's
 * `approach`, from before its first part is near Earth, so Earth is at rest while the years
 * count down, to its leading part sweeping in as they end. */
export function journeyParts(trip: Trip): {
  readonly travel: number;
  readonly arrive: number;
  readonly rest: number;
} {
  return {
    travel: 6000,
    arrive: (trip.window.to - trip.window.from) * SLOWED * 1000,
    rest: trip.after === undefined ? 1500 : 5000,
  };
}

/** GW150914's journey's parts. */
export const JOURNEY_MS = journeyParts(GW150914_TRIP);

export interface JourneyMoment {
  readonly phase: 'travel' | 'arrive' | 'rest';
  /** Years still to go, while it travels. */
  readonly yearsToGo: number;
  /** The wave's own time, s from when the merger's wave reached Livingston. */
  readonly waveTime: number;
  /** The time, s after 09:50:45 UTC, once it is at Earth. */
  readonly utc: number | null;
}

/** How long a journey plays, ms. */
export function journeyMs(trip: Trip = GW150914_TRIP): number {
  const parts = journeyParts(trip);
  return parts.travel + parts.arrive + parts.rest;
}

/**
 * Where the journey is `ms` into it: crossing space, years counting down as its leading part
 * comes in; then sweeping Earth, 100 times slower, the UTC time to the millisecond, the merger's
 * wave reaching Livingston at `atLivingston` s after 09:50:45.
 */
export function journeyAt(
  ms: number,
  atLivingston: number,
  trip: Trip = GW150914_TRIP,
): JourneyMoment {
  const parts = journeyParts(trip);
  const { from, to, approach } = trip.window;
  const into = Math.min(Math.max(ms, 0), journeyMs(trip));
  if (into < parts.travel) {
    const share = into / parts.travel;
    // Counted down on a log scale, so each power of ten gets its share of the time.
    const yearsToGo = trip.lightYears ** (1 - share) - 1;
    return {
      phase: 'travel',
      yearsToGo,
      waveTime: from - approach * (1 - share),
      utc: null,
    };
  }
  const waveTime = Math.min(to, from + (into - parts.travel) / (1000 * SLOWED));
  return {
    phase: into < parts.travel + parts.arrive ? 'arrive' : 'rest',
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

/** Two digits. */
function two(value: number): string {
  return String(value).padStart(2, '0');
}

/** The journey in words, at a moment: the years to go, then the clock and who has heard it. */
export function journeyText(moment: JourneyMoment, trip: Trip = GW150914_TRIP): string {
  if (moment.phase === 'travel') {
    return `Crossing space at the speed of light: ${years(moment.yearsToGo)} years to go`;
  }
  const k = directionOf(trip);
  const { hour, minute, second } = trip.clock;
  const seconds = (second + (moment.utc ?? 0)).toFixed(3).padStart(6, '0');
  const clock = `${two(hour)}:${two(minute)}:${seconds} UTC`;
  if (moment.phase === 'rest' && trip.after !== undefined) return `${clock} · ${trip.after}`;
  const heard = trip.heard.filter((detector) => reached(moment, placeOf(detector), k));
  const last = heard.at(-1);
  if (last === undefined) return `${clock} · reaching Earth`;
  const name = SITES[last].name;
  if (heard.length === 1) return `${clock} · ${name} hears it first`;
  const before = heard.at(-2) ?? last;
  const gap =
    (laterThanLivingston(placeOf(last), k) - laterThanLivingston(placeOf(before), k)) * 1000;
  return `${clock} · ${name} hears it, ${gap.toFixed(1)} ms after ${SITES[before].name}`;
}
