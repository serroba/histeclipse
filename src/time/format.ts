/** Human-readable dates and durations for the interface. */

import type { Moment } from '../state/viewState';
import { elementAt } from '../util/arrays';
import { formatYear } from './year';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const CALENDAR_NAMES = { julian: 'Julian', gregorian: 'Gregorian' } as const;

/** "22 April 621 BCE", in the date's own calendar. */
export function formatDate(moment: Moment): string {
  const { date } = moment;
  const month = elementAt(MONTHS, date.month - 1);
  return `${String(Math.floor(date.day))} ${month} ${formatYear(date.year)}`;
}

/** "07:20 UT". */
export function formatTimeOfDay(moment: Moment): string {
  const hours = String(Math.floor(moment.minuteOfDay / 60)).padStart(2, '0');
  const minutes = String(moment.minuteOfDay % 60).padStart(2, '0');
  return `${hours}:${minutes} UT`;
}

/** "Julian calendar". */
export function formatCalendar(moment: Moment): string {
  return `${CALENDAR_NAMES[moment.date.calendar]} calendar`;
}

/** A duration in seconds as "5 h 13 min", "8 min", "69 s". Rounded to what the size justifies. */
export function formatDuration(seconds: number): string {
  const sign = seconds < 0 ? '−' : '';
  const total = Math.abs(seconds);
  if (total < 90) return `${sign}${String(Math.round(total))} s`;
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${sign}${String(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${sign}${String(hours)} h` : `${sign}${String(hours)} h ${String(rest)} min`;
}
