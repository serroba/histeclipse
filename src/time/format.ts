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
 * "250 million years ago", "252.5 million years ago", "2,408.0 million years ago", or, within the ice ages, in years:
 * "21,000 years ago", "2,581,000 years ago"; or "Today".
 */
export function formatMa(ma: number): string {
  if (ma === 0) return 'Today';
  if (ma < ICE_AGE_WORDS_MA) return `${Math.round(ma * 1e6).toLocaleString('en')} years ago`;
  // Whole where the moment is (3,950.0000001 reads "3,950", #987); otherwise always to a tenth,
  // grouped, so a moment playing keeps its width: "2,468.0", not "2,468" then "2408.5".
  const whole = Math.abs(ma - Math.round(ma)) < 1e-6;
  return whole ? `${Math.round(ma).toLocaleString('en')} million years ago` : tenths(ma);
}

const tenths = (ma: number): string =>
  `${ma.toLocaleString('en', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} million years ago`;

/** How many times a second a playing date may change: slow enough to read (#1166). */
const READS_A_SECOND = 4;

/**
 * The moment while it plays at `maPerSecond`: rounded to a step of 1, 2 or 5 times a power of
 * ten, so the date changes a few times a second and not every frame: "255 million years ago",
 * then "250", at 20 Myr a second; to a tenth, always shown, when slower.
 */
export function formatMaPlaying(ma: number, maPerSecond: number): string {
  const rough = maPerSecond / READS_A_SECOND;
  if (!(rough > 0)) return formatMa(ma);
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 5, 10].find((each) => each * power >= rough) ?? 10) * power;
  const shown = Math.round(ma / step) * step;
  if (shown === 0 || shown < ICE_AGE_WORDS_MA) return formatMa(shown);
  return step >= 1 ? formatMa(Math.round(shown)) : tenths(shown);
}
