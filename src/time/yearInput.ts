/** Reading years people type, and moving a moment to another year. */

import type { Moment } from '../state/viewState';
import { defaultCalendarFor } from '../state/viewState';
import { calendarDateOf, daysInMonth } from './julianDay';
import { toAstronomicalYear, type AstronomicalYear, type Era } from './year';

/**
 * The year typed in the year box: digits only, counted from 1 in the era picked beside it.
 * There is no year 0: 1 BCE is followed by 1 CE.
 */
export function parseYearNumber(text: string, era: Era): AstronomicalYear {
  const digits = text.trim();
  if (!/^\d{1,5}$/.test(digits)) throw new RangeError('Type the year as a number, like 587');
  const year = Number(digits);
  if (year === 0) throw new RangeError('There is no year 0: 1 BCE is followed by 1 CE');
  return toAstronomicalYear({ year, era });
}

/**
 * The same calendar day and time of day in another year, in the calendar in use then.
 * February 29 becomes February 28 in a year without it.
 */
export function moveToYear(moment: Moment, year: AstronomicalYear): Moment {
  const { month, day } = moment.date;
  const calendar = defaultCalendarFor(year, month, Math.floor(day));
  const lastDay = daysInMonth(year, month, calendar);
  return {
    date: calendarDateOf(year, month, Math.min(Math.floor(day), lastDay), calendar),
    minuteOfDay: moment.minuteOfDay,
  };
}
