/**
 * The strike clock (#1173): time from an impact's strike on a log scale, so its seconds, hours,
 * years and the million years after each get their share of the play. The slider runs from the
 * approach (`APPROACH_SECONDS` before) to a million years after: its first unit is the approach,
 * then each unit a tenfold more time since the strike.
 *
 * Pure.
 */

import type { ClockScale } from './clockScale';
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

/**
 * Where the quiet stretch begins: ten years after the strike, once the sky has cleared. From
 * there to the end the globe barely changes and only the phases' words do, so the clock runs
 * twice as fast (#1187): Space pauses it to read one.
 */
export const QUIET_AT = positionAt(10 * YEAR);

/** How much faster the clock runs over the approach, the strike's own time and the quiet. */
function paceAt(position: number): number {
  // The approach at a third, so the strike can be seen coming.
  if (position < STRIKE_AT) return 1 / 3;
  return position >= QUIET_AT ? 2 : 1;
}

/** How far along the slider play moves from `position` in `seconds` of play at `pace`. */
export function clockStep(pace: Pace, seconds: number, position = STRIKE_AT): number {
  return UNITS_PER_SECOND[pace] * paceAt(position) * seconds;
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

/**
 * The marks under the slider: where some of the tenfolds begin. Not the minute: on a phone it
 * would sit on the strike's mark.
 */
const MARKS: readonly (readonly [number, string])[] = [
  [0, 'Strike'],
  [3600, 'Hour'],
  [86_400, 'Day'],
  [YEAR, 'Year'],
  [1000 * YEAR, '1,000 years'],
  [1e6 * YEAR, '1 Myr'],
];

/** Chicxulub's clock (#1173, #1191): log time from the strike. */
export const STRIKE_SCALE: ClockScale = {
  end: CLOCK_END,
  secondsAt,
  positionAt,
  advance: clockStep,
  // A fifth of a tenfold.
  step: 0.2,
  marks: MARKS,
  text: clockText,
  label: 'Time since the strike, each step on a tenfold more',
};
