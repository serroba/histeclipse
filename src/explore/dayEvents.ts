/**
 * Single days on the years bar (#837): an event of one day, such as the first gravitational wave
 * heard, marked in its year beside the year's eclipses and opening its view as its destination
 * does. Finds and eruptions are markers in their layers, and milestones are on the deep-time bar;
 * this is for what happened on a day of the years the bar shows.
 */

import type { Anchor } from '../text/passages';
import { DESTINATIONS, destinationAnchor } from './destinations';

export interface DayEvent {
  /** The year, astronomical, the month (1–12) and the day, in UTC. */
  readonly year: number;
  readonly month: number;
  readonly day: number;
  /** What the chip says: "GW150914: first gravitational wave". */
  readonly label: string;
  /** The view it opens. */
  readonly anchor: Anchor;
}

/** The events, by the destination that opens each one's view (`destinations.ts`). */
const EVENTS: Readonly<
  Record<string, { readonly date: readonly [number, number, number]; readonly label: string }>
> = {
  'gravitational-waves': { date: [2015, 9, 14], label: 'GW150914: first gravitational wave' },
  'neutron-star-merger': { date: [2017, 8, 17], label: 'GW170817: two neutron stars merge' },
};

export const DAY_EVENTS: readonly DayEvent[] = DESTINATIONS.flatMap((destination) => {
  const event = EVENTS[destination.id];
  if (event === undefined) return [];
  const [year, month, day] = event.date;
  return [{ year, month, day, label: event.label, anchor: destinationAnchor(destination) }];
});

/** The events of a year (astronomical), in the order they happened. */
export function dayEventsIn(year: number): readonly DayEvent[] {
  return DAY_EVENTS.filter((event) => event.year === year);
}
