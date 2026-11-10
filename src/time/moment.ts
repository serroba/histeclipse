import type { Calendar, CalendarDate } from './julianDay';

/** A calendar day plus a time of day, in Universal Time, to the minute. */
export interface Moment {
  /** `day` is a whole number here; the time of day lives in `minuteOfDay`. */
  readonly date: CalendarDate;
  /** 0 to 1439. */
  readonly minuteOfDay: number;
}

/** The calendar historians use for a date: Julian before 1582-10-15, Gregorian from then on. */
export function defaultCalendarFor(year: number, month: number, day: number): Calendar {
  const isBeforeReform =
    year < 1582 || (year === 1582 && (month < 10 || (month === 10 && day < 15)));
  return isBeforeReform ? 'julian' : 'gregorian';
}
