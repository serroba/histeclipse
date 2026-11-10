/** The years the bar reaches, counted in the era or calendar picked beside the year. */

import { yearContaining, type YearCalendar } from './calendars';
import { calendarDateOf, julianDay } from './julianDay';
import { astronomicalYear, type Era } from './year';

/** 9700 BCE, the Holocene's start, as far back as ΔT reaches (astronomical year). */
export const FIRST_YEAR = -9699;
/** The last year ΔT and the eclipse catalogues reach. */
export const LAST_YEAR = 3000;

export interface YearRange {
  readonly min: number;
  readonly max: number;
}

/**
 * The years to offer, as the year box shows them: BCE 1 to 9700, CE 1 to 3000, or another
 * calendar's years from 1 that fall between 9700 BCE and 3000 CE.
 */
export function yearRange(calendar: YearCalendar, era: Era): YearRange {
  if (calendar === 'western') return era === 'BCE' ? BCE : CE;
  // The bar asks on every frame while it plays; a lunar calendar's years take a moment to find.
  let range = ranges.get(calendar);
  if (range === undefined) {
    range = otherRange(calendar);
    ranges.set(calendar, range);
  }
  return range;
}

const BCE: YearRange = { min: 1, max: 1 - FIRST_YEAR };
const CE: YearRange = { min: 1, max: LAST_YEAR };
const ranges = new Map<YearCalendar, YearRange>();

function otherRange(calendar: YearCalendar): YearRange {
  const first = julianDay(calendarDateOf(astronomicalYear(FIRST_YEAR), 1, 1, 'julian'));
  const last = julianDay(calendarDateOf(astronomicalYear(LAST_YEAR), 12, 31, 'gregorian'));
  return {
    min: Math.max(1, yearContaining(calendar, first)),
    max: yearContaining(calendar, last),
  };
}
