/** Reading years people type, and moving a moment to another year. */

import type { Moment } from '../state/viewState';
import { defaultCalendarFor } from '../state/viewState';
import { calendarDateOf, daysInMonth } from './julianDay';
import { astronomicalYear, toAstronomicalYear, type AstronomicalYear } from './year';

const PATTERN = /^(?:(ad|ce)\s*)?(-?\d{1,5})\s*(bce|bc|b\.c\.(?:e\.)?|ce|ad|a\.d\.|c\.e\.)?$/i;

/**
 * Accepts "621 BCE", "621 BC", "AD 2025", "2025 CE", "2025", and astronomical "-620".
 * A bare positive number is CE; a minus sign means astronomical numbering (−620 = 621 BCE).
 */
export function parseYearInput(text: string): AstronomicalYear {
  const match = PATTERN.exec(text.trim().replaceAll(/\s+/g, ' '));
  if (match === null) throw new RangeError(`Not a year: ${JSON.stringify(text)}`);
  const [, prefix, digits = '', suffix] = match;
  const value = Number(digits);
  const era = suffix?.toLowerCase().replaceAll('.', '');
  const isBce = era === 'bce' || era === 'bc';
  if (value < 0) {
    if (prefix !== undefined || era !== undefined) {
      throw new RangeError('Use either a minus sign or an era, not both');
    }
    return astronomicalYear(value);
  }
  if (isBce && prefix !== undefined) throw new RangeError('A year cannot be both AD and BC');
  if (value === 0) {
    if (isBce || prefix !== undefined || era !== undefined) {
      throw new RangeError('There is no year 0 BCE or 0 CE; 1 BCE is followed by 1 CE');
    }
    return astronomicalYear(0);
  }
  return toAstronomicalYear({ year: value, era: isBce ? 'BCE' : 'CE' });
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
