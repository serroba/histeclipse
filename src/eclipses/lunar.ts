/** Lunar eclipses as the interface talks about them: when, which one, how deep. */

import { greatestEclipseUT, type LunarEclipse } from '../data/lunarCatalog';
import type { Moment, Selection } from '../state/viewState';
import {
  calendarDate,
  historicalCalendar,
  julianDay,
  julianDayNumber,
  type CalendarDate,
} from '../time/julianDay';

const MINUTES_PER_DAY = 1440;

/** Greatest eclipse in UT, to the nearest minute, in the calendar in use at the time. */
export function eclipseMoment(eclipse: LunarEclipse): Moment {
  // Round first, then split into day and minute, so 23:59:40 becomes 00:00 the next day.
  const minutes = Math.round((greatestEclipseUT(eclipse) + 0.5) * MINUTES_PER_DAY);
  const midnight = julianDayNumber(Math.floor(minutes / MINUTES_PER_DAY) - 0.5);
  const date = calendarDate(midnight, historicalCalendar(midnight));
  return { date, minuteOfDay: minutes % MINUTES_PER_DAY };
}

export function eclipseSelection(eclipse: LunarEclipse): Selection {
  return { kind: 'lunar', date: eclipseMoment(eclipse).date };
}

function sameDay(a: CalendarDate, b: CalendarDate): boolean {
  // Compare as Julian Days, so the calendar each date is written in doesn't matter.
  return Math.floor(julianDay(a) + 0.5) === Math.floor(julianDay(b) + 0.5);
}

/** The eclipse a link's `sel` parameter points at, if it is among `eclipses`. */
export function findSelected(
  eclipses: readonly LunarEclipse[],
  selection: Selection | null,
): LunarEclipse | undefined {
  if (selection?.kind !== 'lunar') return undefined;
  return eclipses.find((eclipse) => sameDay(eclipseMoment(eclipse).date, selection.date));
}

const KIND_NAMES = {
  total: 'Total lunar eclipse',
  partial: 'Partial lunar eclipse',
  penumbral: 'Penumbral lunar eclipse',
} as const;

/** "Total lunar eclipse", plus how deep: umbral magnitude, or penumbral for faint ones. */
export function describeLunarEclipse(eclipse: LunarEclipse): { title: string; depth: string } {
  const depth =
    eclipse.kind === 'penumbral'
      ? `penumbral magnitude ${eclipse.penumbralMagnitude.toFixed(2)}`
      : `umbral magnitude ${eclipse.umbralMagnitude.toFixed(2)}`;
  return { title: KIND_NAMES[eclipse.kind], depth };
}
