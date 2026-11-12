/** Human-readable dates and durations for the interface. */

import type { Moment } from './moment';
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

/**
 * A duration in seconds as "4 d 9 h", "5 h 13 min", "8 min", "69 s". Rounded to what the size
 * justifies: from two days, to the hour (ΔT early in the Holocene).
 */
export function formatDuration(seconds: number): string {
  const sign = seconds < 0 ? '−' : '';
  const total = Math.abs(seconds);
  if (total < 90) return `${sign}${String(Math.round(total))} s`;
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${sign}${String(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours >= 48) {
    const wholeHours = Math.round(total / 3600);
    const days = Math.floor(wholeHours / 24);
    const left = wholeHours % 24;
    return left === 0 ? `${sign}${String(days)} d` : `${sign}${String(days)} d ${String(left)} h`;
  }
  const rest = minutes % 60;
  return rest === 0 ? `${sign}${String(hours)} h` : `${sign}${String(hours)} h ${String(rest)} min`;
}

/** Below this, moments read in years: the scale of the ice ages. */
const ICE_AGE_WORDS_MA = 3;

/**
 * "250 million years ago", "252.5 million years ago", or, within the ice ages, in years:
 * "21,000 years ago", "2,581,000 years ago"; or "Today".
 */
export function formatMa(ma: number): string {
  if (ma === 0) return 'Today';
  if (ma < ICE_AGE_WORDS_MA) return `${Math.round(ma * 1e6).toLocaleString('en')} years ago`;
  const amount = Number.isInteger(ma) ? ma.toLocaleString('en') : ma.toFixed(1);
  return `${amount} million years ago`;
}
