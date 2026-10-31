/**
 * Years and dates in calendars other than the Julian/Gregorian one: the Hebrew calendar, the
 * Islamic calendar, the Egyptian civil calendar counted from Nabonassar, and Rome's years
 * from the founding of the city.
 *
 * All are arithmetic, so a date converts exactly:
 * - Hebrew: the fixed calendar of Hillel II (lunisolar: 19-year cycle, molad, postponements),
 *   as in Reingold & Dershowitz, *Calendrical Calculations*. Before the 4th century CE it is
 *   proleptic: the calendar then was set by observation and may differ by a month.
 * - Islamic: the tabular (civil) calendar, 30-year cycle with 11 leap years. Months actually
 *   began when the new crescent was seen, which can be a day or two off this table.
 * - Egyptian: 12 months of 30 days and 5 extra days, no leap years, counted from 1 Thoth of
 *   Nabonassar's first year (26 February 747 BCE). Ptolemy dated Babylonian eclipses this way.
 * - Roman: Varro's count from the founding of Rome (753 BCE = year 1), on Julian/Gregorian dates.
 *
 * Days are civil days from midnight; the Hebrew and Islamic days really begin at sunset the
 * evening before, so an event after sunset belongs to the next day in those calendars.
 */

import {
  calendarDate,
  historicalCalendar,
  julianDay,
  julianDayNumber,
  type JulianDay,
} from './julianDay';
import { astronomicalYear } from './year';

export const YEAR_CALENDARS = ['western', 'hebrew', 'islamic', 'egyptian', 'roman'] as const;
export type YearCalendar = (typeof YEAR_CALENDARS)[number];

export interface YearCalendarInfo {
  readonly name: string;
  /** Written after the year: "5785 AM". Empty for the western calendar, which uses BCE/CE. */
  readonly era: string;
}

export const CALENDAR_INFO: Readonly<Record<YearCalendar, YearCalendarInfo>> = {
  western: { name: 'Julian / Gregorian', era: '' },
  hebrew: { name: 'Hebrew', era: 'AM' },
  islamic: { name: 'Islamic', era: 'AH' },
  egyptian: { name: 'Egyptian', era: 'Nab.' },
  roman: { name: 'Roman', era: 'AUC' },
};

/** The days of one calendar year: from midnight starting its first day to the next year's. */
export interface YearSpan {
  readonly start: JulianDay;
  readonly end: JulianDay;
}

/** A date in one of these calendars. */
export interface OtherDate {
  readonly year: number;
  /** 1-based; the Egyptian five extra days are month 13. */
  readonly month: number;
  readonly day: number;
  readonly monthName: string;
}

// Day numbers here are "fixed days" (R.D.): day 1 is 1 January 1 CE (Gregorian).
const RD_TO_JD = 1_721_424.5;

function toJulianDay(rd: number): JulianDay {
  return julianDayNumber(rd + RD_TO_JD);
}

/** The fixed day containing a Julian Day (civil days from midnight). */
function fixedDay(jd: JulianDay): number {
  return Math.floor(jd - RD_TO_JD);
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

// --- Hebrew ---------------------------------------------------------------------------------

/** 1 Tishri, year 1 AM: 7 October 3761 BCE (Julian). */
const HEBREW_EPOCH = -1_373_427;
const PARTS_PER_DAY = 25_920;

export function isHebrewLeapYear(year: number): boolean {
  return mod(7 * year + 1, 19) < 7;
}

/** Days from the epoch to the molad of Tishri of `year`, after the first postponement. */
function hebrewElapsedDays(year: number): number {
  const months = Math.floor((235 * year - 234) / 19);
  const parts = 12_084 + 13_753 * months;
  const days = 29 * months + Math.floor(parts / PARTS_PER_DAY);
  // Rosh Hashanah never falls on Sunday, Wednesday or Friday.
  return mod(3 * (days + 1), 7) < 3 ? days + 1 : days;
}

/** The remaining postponements, which keep every year to an allowed length. */
function hebrewYearDelay(year: number): number {
  const before = hebrewElapsedDays(year - 1);
  const now = hebrewElapsedDays(year);
  const after = hebrewElapsedDays(year + 1);
  if (after - now === 356) return 2;
  if (now - before === 382) return 1;
  return 0;
}

function hebrewNewYear(year: number): number {
  return HEBREW_EPOCH + hebrewElapsedDays(year) + hebrewYearDelay(year);
}

/** Months from Tishri with their lengths for a year of `length` days. */
function hebrewMonths(year: number, length: number): readonly (readonly [string, number])[] {
  // A "complete" year has a 30-day Heshvan; a "deficient" one a 29-day Kislev.
  const heshvan = mod(length, 10) === 5 ? 30 : 29;
  const kislev = mod(length, 10) === 3 ? 29 : 30;
  const adar: readonly (readonly [string, number])[] = isHebrewLeapYear(year)
    ? [
        ['Adar I', 30],
        ['Adar II', 29],
      ]
    : [['Adar', 29]];
  return [
    ['Tishri', 30],
    ['Heshvan', heshvan],
    ['Kislev', kislev],
    ['Tevet', 29],
    ['Shevat', 30],
    ...adar,
    ['Nisan', 30],
    ['Iyar', 29],
    ['Sivan', 30],
    ['Tammuz', 29],
    ['Av', 30],
    ['Elul', 29],
  ];
}

function hebrewYearOf(rd: number): number {
  let year = Math.floor((rd - HEBREW_EPOCH) / 365.246_822) + 1;
  while (hebrewNewYear(year + 1) <= rd) year++;
  while (hebrewNewYear(year) > rd) year--;
  return year;
}

// --- Islamic --------------------------------------------------------------------------------

/** 1 Muharram 1 AH: 16 July 622 (Julian). */
const ISLAMIC_EPOCH = 227_015;
const ISLAMIC_MONTHS = [
  'Muharram',
  'Safar',
  'Rabi I',
  'Rabi II',
  'Jumada I',
  'Jumada II',
  'Rajab',
  'Shaban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qadah',
  'Dhu al-Hijjah',
];

export function isIslamicLeapYear(year: number): boolean {
  return mod(14 + 11 * year, 30) < 11;
}

function islamicFixed(year: number, month: number, day: number): number {
  return (
    ISLAMIC_EPOCH -
    1 +
    (year - 1) * 354 +
    Math.floor((3 + 11 * year) / 30) +
    29 * (month - 1) +
    Math.floor(month / 2) +
    day
  );
}

function islamicYearOf(rd: number): number {
  return Math.floor((30 * (rd - ISLAMIC_EPOCH) + 10_646) / 10_631);
}

// --- Egyptian -------------------------------------------------------------------------------

/** 1 Thoth, year 1 of Nabonassar: 26 February 747 BCE (Julian), JD 1448638 at noon. */
const EGYPTIAN_EPOCH = 1_448_638 - 0.5 - RD_TO_JD;
const EGYPTIAN_MONTHS = [
  'Thoth',
  'Phaophi',
  'Athyr',
  'Choiak',
  'Tybi',
  'Mechir',
  'Phamenoth',
  'Pharmuthi',
  'Pachon',
  'Payni',
  'Epiphi',
  'Mesore',
  'extra day',
];

// --- Roman ----------------------------------------------------------------------------------

/** Varro: 1 AUC is 753 BCE, astronomical year −752. */
const AUC_OFFSET = 753;

function westernNewYear(year: number): number {
  const calendar = year > 1582 ? 'gregorian' : 'julian';
  return fixedDay(julianDay({ year: astronomicalYear(year), month: 1, day: 1, calendar }));
}

// --- Public API -----------------------------------------------------------------------------

/** The first day of `year` (as a fixed day). Western years are astronomical (0 = 1 BCE). */
function newYear(calendar: YearCalendar, year: number): number {
  switch (calendar) {
    case 'western':
      return westernNewYear(year);
    case 'roman':
      return westernNewYear(year - AUC_OFFSET);
    case 'hebrew':
      return hebrewNewYear(year);
    case 'islamic':
      return islamicFixed(year, 1, 1);
    case 'egyptian':
      return EGYPTIAN_EPOCH + (year - 1) * 365;
  }
}

/** The days of `year` in `calendar`. */
export function yearSpan(calendar: YearCalendar, year: number): YearSpan {
  return {
    start: toJulianDay(newYear(calendar, year)),
    end: toJulianDay(newYear(calendar, year + 1)),
  };
}

/** The year of `calendar` that a moment falls in. */
export function yearContaining(calendar: YearCalendar, jd: JulianDay): number {
  const rd = fixedDay(jd);
  switch (calendar) {
    case 'western':
      return calendarDate(jd, historicalCalendar(jd)).year;
    case 'roman':
      return calendarDate(jd, historicalCalendar(jd)).year + AUC_OFFSET;
    case 'hebrew':
      return hebrewYearOf(rd);
    case 'islamic':
      return islamicYearOf(rd);
    case 'egyptian':
      return Math.floor((rd - EGYPTIAN_EPOCH) / 365) + 1;
  }
}

/** The date in a non-western calendar of the civil day containing `jd`. */
export function otherDate(
  calendar: Exclude<YearCalendar, 'western' | 'roman'>,
  jd: JulianDay,
): OtherDate {
  const rd = fixedDay(jd);
  const year = yearContaining(calendar, jd);
  let left = rd - newYear(calendar, year);
  if (calendar === 'egyptian') {
    const month = Math.floor(left / 30) + 1;
    return { year, month, day: (left % 30) + 1, monthName: EGYPTIAN_MONTHS[month - 1] ?? '' };
  }
  const months =
    calendar === 'hebrew'
      ? hebrewMonths(year, newYear('hebrew', year + 1) - newYear('hebrew', year))
      : ISLAMIC_MONTHS.map(
          (name, index) =>
            [
              name,
              index === 11 && isIslamicLeapYear(year) ? 30 : index % 2 === 0 ? 30 : 29,
            ] as const,
        );
  for (const [index, [name, length]] of months.entries()) {
    if (left < length) return { year, month: index + 1, day: left + 1, monthName: name };
    left -= length;
  }
  throw new RangeError('Day beyond the end of its year'); // unreachable: months fill the year
}

/** "3175 AM", "1446 AH", "167 Nab.", "754 AUC"; western years as "587 BCE". */
export function formatCalendarYear(calendar: YearCalendar, year: number): string {
  if (calendar === 'western') {
    return year >= 1 ? `${String(year)} CE` : `${String(1 - year)} BCE`;
  }
  return `${String(year)} ${CALENDAR_INFO[calendar].era}`;
}

/** The civil day containing `jd` in a calendar: "11 Shevat 3175 AM". */
export function formatInCalendar(calendar: YearCalendar, jd: JulianDay): string {
  if (calendar === 'western' || calendar === 'roman') {
    const date = calendarDate(jd, historicalCalendar(jd));
    const year = calendar === 'roman' ? date.year + AUC_OFFSET : date.year;
    return `${String(Math.floor(date.day))} ${MONTH_NAMES[date.month - 1] ?? ''} ${formatCalendarYear(calendar, year)}`;
  }
  const date = otherDate(calendar, jd);
  if (calendar === 'egyptian' && date.month === 13) {
    return `extra day ${String(date.day)}, ${formatCalendarYear(calendar, date.year)}`;
  }
  return `${String(date.day)} ${date.monthName} ${formatCalendarYear(calendar, date.year)}`;
}

const MONTH_NAMES = [
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
];

/** Day and month only, for a list within one year: "11 Shevat", "29 Thoth", "23 Jan". */
export function shortDate(calendar: YearCalendar, jd: JulianDay): string {
  if (calendar === 'western' || calendar === 'roman') {
    const date = calendarDate(jd, historicalCalendar(jd));
    return `${String(Math.floor(date.day))} ${MONTH_NAMES[date.month - 1]?.slice(0, 3) ?? ''}`;
  }
  const date = otherDate(calendar, jd);
  if (calendar === 'egyptian' && date.month === 13) return `extra day ${String(date.day)}`;
  return `${String(date.day)} ${date.monthName}`;
}
