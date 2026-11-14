/**
 * How fast the launches play at a moment (#702): the pace picked between departures (50 days a
 * second unless changed, slow enough to follow a cruise, #710); slow from half a day before a
 * craft leaves Earth's orbit to three days after, so it can be seen going (a trip to the Moon
 * takes about three days); and easing from one to the other over a day and a half,
 * geometrically, so the change reads as a glide.
 */

import { gcatJd, type Craft } from '../../data/spacecraft';

/** Days a second while a craft leaves. */
export const DEPARTING_PACE = 6;
const BEFORE = 0.5;
const AFTER = 3;
const EASE = 1.5;

/** When each craft left Earth's orbit (its first phase's start, UT), earliest first, once each. */
export function departures(craft: readonly Craft[]): readonly number[] {
  const out = new Set<number>();
  for (const each of craft) {
    const began = each.phases[0]?.[1];
    if (!each.part && began !== null && began !== undefined) out.add(gcatJd(began));
  }
  return [...out].sort((a, b) => a - b);
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

/** Days a second at `jd` (UT), with `cruising` days a second away from any departure. */
export function launchPace(departed: readonly number[], jd: number, cruising: number): number {
  const slow = Math.min(DEPARTING_PACE, cruising);
  const away = Math.min(fromDeparting(departed, jd) / EASE, 1);
  return slow * (cruising / slow) ** away;
}
