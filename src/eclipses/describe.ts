/** Eclipses as the interface talks about them: when, which one, how deep. */

import { greatestEclipseUT, type CatalogRecord } from '../data/catalog';
import type { LunarEclipse } from '../data/lunarCatalog';
import type { SolarEclipse } from '../data/solarCatalog';
import type { Moment, Selection } from '../state/viewState';
import {
  calendarDate,
  historicalCalendar,
  julianDay,
  julianDayNumber,
  type CalendarDate,
  type JulianDay,
} from '../time/julianDay';

const MINUTES_PER_DAY = 1440;

/** Greatest eclipse in UT, to the nearest minute, in the calendar in use at the time. */
export function eclipseMoment(eclipse: CatalogRecord): Moment {
  return momentAt(greatestEclipseUT(eclipse));
}

/** A UT Julian Day as a moment, to the nearest minute, in the calendar in use at the time. */
export function momentAt(jdUT: JulianDay): Moment {
  // Round first, then split into day and minute, so 23:59:40 becomes 00:00 the next day.
  const minutes = Math.round((jdUT + 0.5) * MINUTES_PER_DAY);
  const midnight = julianDayNumber(Math.floor(minutes / MINUTES_PER_DAY) - 0.5);
  const date = calendarDate(midnight, historicalCalendar(midnight));
  return { date, minuteOfDay: minutes % MINUTES_PER_DAY };
}

export function eclipseSelection(eclipse: LunarEclipse | SolarEclipse): Selection {
  return { kind: isSolar(eclipse) ? 'solar' : 'lunar', date: eclipseMoment(eclipse).date };
}

export function isSolar(eclipse: LunarEclipse | SolarEclipse): eclipse is SolarEclipse {
  return 'elements' in eclipse;
}

function sameDay(a: CalendarDate, b: CalendarDate): boolean {
  // Compare as Julian Days, so the calendar each date is written in doesn't matter.
  return Math.floor(julianDay(a) + 0.5) === Math.floor(julianDay(b) + 0.5);
}

/** The eclipse a link's `sel` parameter points at, if it is among `eclipses`. */
export function findSelected<Eclipse extends LunarEclipse | SolarEclipse>(
  eclipses: readonly Eclipse[],
  selection: Selection | null,
): Eclipse | undefined {
  if (selection === null) return undefined;
  return eclipses.find(
    (eclipse) =>
      eclipseSelection(eclipse).kind === selection.kind &&
      sameDay(eclipseMoment(eclipse).date, selection.date),
  );
}

const SOLAR_KIND_NAMES = {
  total: 'Total solar eclipse',
  annular: 'Annular solar eclipse',
  hybrid: 'Hybrid solar eclipse',
  partial: 'Partial solar eclipse',
} as const;

/** "Total solar eclipse", plus the magnitude at greatest eclipse. */
export function describeSolarEclipse(eclipse: SolarEclipse): { title: string; depth: string } {
  return {
    title: SOLAR_KIND_NAMES[eclipse.kind],
    depth: `magnitude ${eclipse.magnitude.toFixed(3)} at greatest eclipse`,
  };
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
