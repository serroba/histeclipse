/**
 * Julian Day conversion for proleptic Julian and Gregorian calendar dates.
 *
 * Mirrors `data-pipeline/src/histeclipse_pipeline/julian_day.py` (Meeus, *Astronomical
 * Algorithms*, ch. 7). Both are tested against the same vectors in `test-vectors/`.
 * Floor division keeps the formulas continuous for negative years, and integer arithmetic
 * replaces the classic `30.6001` floating-point fudge.
 */

import { astronomicalYear, type AstronomicalYear } from './year';

declare const julianDayBrand: unique symbol;

/** Days since -4712 January 1, 12h (Julian calendar). The time scale (TT, UT) is up to the caller. */
export type JulianDay = number & { readonly [julianDayBrand]: true };

export type Calendar = 'julian' | 'gregorian';

export interface CalendarDate {
  readonly year: AstronomicalYear;
  readonly month: number;
  /** Day of month with a fraction: 1.5 is noon on the 1st. */
  readonly day: number;
  readonly calendar: Calendar;
}

/** Julian Day of 1582 October 15 (Gregorian) at 0h, the first day of the Gregorian reform. */
export const GREGORIAN_REFORM_JD = julianDayNumber(2_299_160.5);

export function julianDayNumber(value: number): JulianDay {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Julian Day must be finite and non-negative, got ${String(value)}`);
  }
  return value as JulianDay;
}

export function isLeapYear(year: AstronomicalYear, calendar: Calendar): boolean {
  if (calendar === 'julian') {
    return mod(year, 4) === 0;
  }
  return mod(year, 4) === 0 && (mod(year, 100) !== 0 || mod(year, 400) === 0);
}

export function daysInMonth(year: AstronomicalYear, month: number, calendar: Calendar): number {
  if (month === 2) {
    return isLeapYear(year, calendar) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Validate and build a calendar date. Throws RangeError for dates that do not exist. */
export function calendarDateOf(
  year: AstronomicalYear,
  month: number,
  day: number,
  calendar: Calendar,
): CalendarDate {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Month must be in 1..12, got ${String(month)}`);
  }
  const lastDay = daysInMonth(year, month, calendar);
  if (!(day >= 1 && day < lastDay + 1)) {
    throw new RangeError(`Day must be in [1, ${String(lastDay + 1)}), got ${String(day)}`);
  }
  return { year, month, day, calendar };
}

export function julianDay(date: CalendarDate): JulianDay {
  let year: number = date.year;
  let month = date.month;
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  let correction = 0;
  if (date.calendar === 'gregorian') {
    const century = Math.floor(year / 100);
    correction = 2 - century + Math.floor(century / 4);
  }
  const jd =
    Math.floor(365.25 * (year + 4716)) +
    Math.floor((306 * (month + 1)) / 10) +
    date.day +
    correction -
    1524.5;
  if (jd < 0) {
    throw new RangeError(`Dates before Julian Day 0 are not supported`);
  }
  return jd as JulianDay;
}

export function calendarDate(jd: JulianDay, calendar: Calendar): CalendarDate {
  const whole = Math.floor(jd + 0.5);
  const fraction = jd + 0.5 - whole;
  let a = whole;
  if (calendar === 'gregorian') {
    const alpha = Math.floor((whole - 1_867_216.25) / 36_524.25);
    a = whole + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor(((b - d) * 10_000) / 306_001);
  const day = b - d - Math.floor((306 * e) / 10) + fraction;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return { year: astronomicalYear(year), month, day, calendar };
}

/** The calendar historians use for a date: Julian before the 1582 reform, Gregorian after. */
export function historicalCalendar(jd: JulianDay): Calendar {
  return jd < GREGORIAN_REFORM_JD ? 'julian' : 'gregorian';
}

/** Python-style modulo: the result has the sign of the divisor, so it works for negative years. */
function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
