/**
 * How fast the launches play at a moment (#702): the pace picked between departures (50 days a
 * second unless changed, slow enough to follow a cruise, #710); slow from half a day before a
 * craft leaves Earth's orbit to three days after, so it can be seen going (a trip to the Moon
 * takes about three days); and easing from one to the other, geometrically, over half a second
 * of the reader's time whatever the pace (#769), so the change reads as a glide, not a stall.
 * Only the departures that can be seen from where the camera is slow it: from out among the
 * planets a craft heading for the Moon is lost in Earth's dot, and the play goes on at its pace.
 */

import { gcatJd, type Craft } from '../../data/spacecraft';

/** Days a second while a craft leaves. */
export const DEPARTING_PACE = 6;
const BEFORE = 0.5;
const AFTER = 3;
/** Seconds the pace takes to ease between slow and fast, either way. */
export const EASE_SECONDS = 0.5;

/** How far a craft heads as it leaves Earth, in Earth radii: the Moon (and the Earth–Moon L
 * points, or another craft about Earth), the Sun–Earth L points (1.5 million km), or out about
 * the Sun (1 AU, at least), its first stretch's next stop. */
const MOON_REACH = 64;
const SUN_EARTH_L_REACH = 236;
const SUN_REACH = 23_455;
/** A departure is seen from up to this many times as far as it reaches. */
const SEEN_FROM = 100;

/** A craft leaving Earth's orbit: when (UT JD), and how far it heads, Earth radii. */
export interface Departure {
  readonly jd: number;
  readonly reach: number;
}

/** How far a craft heads as it leaves, Earth radii. */
function reachOf(next: string): number {
  if (next === 'HCO') return SUN_REACH;
  return next.startsWith('SEL') ? SUN_EARTH_L_REACH : MOON_REACH;
}

/** When each craft left Earth's orbit (its first phase's start, UT), earliest first, once each:
 * craft leaving together reach as far as the farthest. */
export function departures(craft: readonly Craft[]): readonly Departure[] {
  const out = new Map<number, number>();
  for (const each of craft) {
    const first = each.phases[0];
    const began = first?.[1];
    if (each.part || first === undefined || began === null || began === undefined) continue;
    const jd = gcatJd(began);
    out.set(jd, Math.max(out.get(jd) ?? 0, reachOf(first[4])));
  }
  return [...out].map(([jd, reach]) => ({ jd, reach })).sort((a, b) => a.jd - b.jd);
}

/** The days of the departures seen from `sight` Earth radii away (the camera's distance from
 * the body in focus), earliest first. */
export function seenFrom(departed: readonly Departure[], sight: number): readonly number[] {
  return departed.filter(({ reach }) => reach * SEEN_FROM >= sight).map(({ jd }) => jd);
}

/** The first index in sorted `days` at or after `jd`. */
function firstFrom(days: readonly number[], jd: number): number {
  let low = 0;
  let high = days.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((days[middle] ?? Infinity) < jd) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Days from `jd` to the nearest departure's slow stretch; 0 within one. */
function fromDeparting(departed: readonly number[], jd: number): number {
  // A departure counts from BEFORE ahead of it to AFTER behind it: the next one, and those just
  // gone, are the only ones that can be near.
  const next = firstFrom(departed, jd - AFTER);
  let nearest = Infinity;
  for (const day of departed.slice(Math.max(0, next - 1), next + 2)) {
    const distance = jd < day - BEFORE ? day - BEFORE - jd : Math.max(0, jd - day - AFTER);
    nearest = Math.min(nearest, distance);
  }
  return nearest;
}

/**
 * Days over which the pace eases from `slow` to `cruising` so that it takes `EASE_SECONDS`: at a
 * pace growing geometrically by `ratio` over `d` days, they take d (1 − 1/ratio) / (slow ln ratio)
 * seconds.
 */
function easeDays(slow: number, cruising: number): number {
  const ratio = cruising / slow;
  return (EASE_SECONDS * slow * Math.log(ratio)) / (1 - 1 / ratio);
}

/** Days a second at `jd` (UT), with `cruising` days a second away from the `departed` days. */
export function launchPace(departed: readonly number[], jd: number, cruising: number): number {
  if (cruising <= DEPARTING_PACE) return cruising;
  const away = Math.min(fromDeparting(departed, jd) / easeDays(DEPARTING_PACE, cruising), 1);
  return DEPARTING_PACE * (cruising / DEPARTING_PACE) ** away;
}
