/**
 * The bar's years in the calendar picked (#447): the year shown, the same point in another year,
 * and the western years a year of another calendar spans. Pure.
 */

import { momentAt } from '../../eclipses/describe';
import { momentJulianDay, type ViewState } from '../../state/viewState';
import { yearContaining, yearSpan } from '../../time/calendars';
import { julianDayNumber } from '../../time/julianDay';
import { astronomicalYear, type AstronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';

const MINUTES_PER_DAY = 1440;

/** The year on the bar: in the calendar picked, holding the moment shown. */
export function barYear(state: ViewState): number {
  return state.years === 'western'
    ? state.time.date.year
    : yearContaining(state.years, momentJulianDay(state.time));
}

/**
 * The same point in another year of the bar's calendar: the same date for western years, and
 * the same number of days into the year for the others.
 */
export function timeInYear(state: ViewState, year: number): ViewState['time'] {
  if (state.years === 'western') return moveToYear(state.time, astronomicalYear(year));
  const now = momentJulianDay(state.time);
  const from = yearSpan(state.years, barYear(state));
  const to = yearSpan(state.years, year);
  const into = Math.min(now - from.start, to.end - to.start - 1 / MINUTES_PER_DAY);
  return momentAt(julianDayNumber(to.start + into));
}

/** The western years a year of the bar spans: one, or two for a year starting mid-way. */
export function westernYearsOf(state: ViewState, year: number): readonly AstronomicalYear[] | null {
  if (state.years === 'western') return [astronomicalYear(year)];
  try {
    const { start, end } = yearSpan(state.years, year);
    const first = yearContaining('western', start);
    const last = yearContaining('western', julianDayNumber(end - 1 / MINUTES_PER_DAY));
    return Array.from({ length: last - first + 1 }, (_, index) => astronomicalYear(first + index));
  } catch {
    return null; // Before the start of the Julian Day count.
  }
}
