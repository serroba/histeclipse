/**
 * The strike clock (#1173): time from an impact's strike on a log scale, so its seconds, hours,
 * years and the million years after each get their share of the play. The slider runs from the
 * approach (`APPROACH_SECONDS` before) to a million years after: its first unit is the approach,
 * then each unit a tenfold more time since the strike.
 *
 * Pure.
 */

import type { Pace } from './playSpeed';

const YEAR = 365.25 * 86_400;
/** Seconds before the strike the clock starts: the impactor coming in. */
export const APPROACH_SECONDS = 10;
/** Where the strike is on the slider: after the approach. */
export const STRIKE_AT = 1;
/** The clock's end: a million years after the strike, its slider's last position. */
export const CLOCK_END = STRIKE_AT + Math.log10(1e6 * YEAR + 1);

/** Seconds since the strike (negative before it) at `position` on the slider. */
export function secondsAt(position: number): number {
  const at = Math.min(CLOCK_END, Math.max(0, position));
  if (at < STRIKE_AT) return -APPROACH_SECONDS * (STRIKE_AT - at);
  return 10 ** (at - STRIKE_AT) - 1;
}

/** Where on the slider `seconds` since the strike is. */
export function positionAt(seconds: number): number {
  if (seconds <= 0) return Math.max(0, STRIKE_AT + seconds / APPROACH_SECONDS);
  return Math.min(CLOCK_END, STRIKE_AT + Math.log10(seconds + 1));
}

/** Slider units a second at each pace: the whole clock in about a minute, 20 s or 7 s. */
const UNITS_PER_SECOND: Readonly<Record<Pace, number>> = { slow: 0.25, normal: 0.75, fast: 2 };

/** How far along the slider play moves in `seconds` of play at `pace`. */
export function clockStep(pace: Pace, seconds: number): number {
  return UNITS_PER_SECOND[pace] * seconds;
}

const UNITS: readonly (readonly [number, string])[] = [
  [1e6 * YEAR, 'million year'],
  [1e3 * YEAR, 'thousand year'],
  [YEAR, 'year'],
  [86_400, 'day'],
  [3600, 'hour'],
  [60, 'minute'],
  [1, 'second'],
];

/** `seconds` in the largest unit that holds it, to two figures at most: "3 hours", "1.5 days". */
export function durationText(seconds: number): string {
  const size = Math.abs(seconds);
  const [unit, name] = UNITS.find(([each]) => size >= each) ?? [1, 'second'];
  const count = Number((size / unit).toPrecision(size / unit < 10 ? 2 : 3));
  const rounded = count >= 10 ? Math.round(count) : count;
  // "1 second", "1 year", but "1 million years".
  const one = rounded === 1 && !name.includes(' ');
  return `${rounded.toLocaleString('en')} ${one ? name : `${name}s`}`;
}

/** What the clock says at `seconds` since the strike: "10 seconds before", "3 hours after". */
export function clockText(seconds: number): string {
  if (Math.abs(seconds) < 0.05) return 'The strike';
  return `${durationText(seconds)} ${seconds < 0 ? 'before' : 'after'}`;
}

/** The moment of deep time, Ma, `seconds` after a strike at `strikeMa`. */
export function maAfter(strikeMa: number, seconds: number): number {
  return strikeMa - Math.max(0, seconds) / (1e6 * YEAR);
}
