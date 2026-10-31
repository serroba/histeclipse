import { describe, expect, it } from 'vitest';

import vectors from '../../test-vectors/calendars.json';
import {
  formatCalendarYear,
  formatInCalendar,
  isHebrewLeapYear,
  isIslamicLeapYear,
  otherDate,
  YEAR_CALENDARS,
  yearContaining,
  yearSpan,
} from './calendars';
import { julianDay, julianDayNumber } from './julianDay';
import { astronomicalYear } from './year';

const jd = (value: number) => julianDayNumber(value);
const on = (year: number, month: number, day: number, calendar: 'julian' | 'gregorian') =>
  julianDay({ year: astronomicalYear(year), month, day, calendar });

// convertdate numbers Hebrew months from Nisan; in a leap year 12 is Adar I and 13 Adar II.
const HEBREW_FROM_NISAN = [
  'Nisan',
  'Iyar',
  'Sivan',
  'Tammuz',
  'Av',
  'Elul',
  'Tishri',
  'Heshvan',
  'Kislev',
  'Tevet',
  'Shevat',
];
function hebrewMonthName(year: number, month: number): string {
  if (month === 12) return isHebrewLeapYear(year) ? 'Adar I' : 'Adar';
  if (month === 13) return 'Adar II';
  return HEBREW_FROM_NISAN[month - 1] ?? '';
}

describe('Hebrew calendar', () => {
  it('starts 5785 on 3 October 2024 and 5784, a leap year, on 16 September 2023', () => {
    expect(yearSpan('hebrew', 5785).start).toBe(on(2024, 10, 3, 'gregorian'));
    expect(yearSpan('hebrew', 5784)).toEqual({
      start: on(2023, 9, 16, 'gregorian'),
      end: on(2024, 10, 3, 'gregorian'),
    });
    expect(isHebrewLeapYear(5784)).toBe(true);
    expect(isHebrewLeapYear(5785)).toBe(false);
  });

  it('puts Passover 5784 (15 Nisan) on 23 April 2024', () => {
    expect(formatInCalendar('hebrew', on(2024, 4, 23, 'gregorian'))).toBe('15 Nisan 5784 AM');
  });

  it.each(vectors.hebrewNewYears)('starts year %i as convertdate does', (year, start) => {
    expect(yearSpan('hebrew', year).start).toBe(start);
  });

  it.each(vectors.hebrew)('dates JD %d as convertdate: %i/%i/%i', (day, year, month, date) => {
    const found = otherDate('hebrew', jd(day));
    expect([found.year, found.monthName, found.day]).toEqual([
      year,
      hebrewMonthName(year, month),
      date,
    ]);
  });
});

describe('Islamic calendar', () => {
  it('begins on 16 July 622 (Julian)', () => {
    expect(yearSpan('islamic', 1).start).toBe(on(622, 7, 16, 'julian'));
    expect(formatInCalendar('islamic', on(622, 7, 16, 'julian'))).toBe('1 Muharram 1 AH');
  });

  it('has 11 leap years of 355 days in every 30', () => {
    const leap = Array.from({ length: 30 }, (_, index) => index + 1).filter(isIslamicLeapYear);
    expect(leap).toEqual([2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29]);
    const { start, end } = yearSpan('islamic', 2);
    expect(end - start).toBe(355);
  });

  it.each(vectors.islamicNewYears)('starts year %i as convertdate does', (year, start) => {
    expect(yearSpan('islamic', year).start).toBe(start);
  });

  it.each(vectors.islamic)('dates JD %d as convertdate: %i/%i/%i', (day, year, month, date) => {
    const found = otherDate('islamic', jd(day));
    expect([found.year, found.month, found.day]).toEqual([year, month, date]);
  });
});

describe('Egyptian calendar of Nabonassar', () => {
  it('begins on 26 February 747 BCE (Julian)', () => {
    expect(yearSpan('egyptian', 1)).toEqual({
      start: on(-746, 2, 26, 'julian'),
      end: on(-745, 2, 26, 'julian'),
    });
  });

  it('dates Ptolemy’s first Babylonian eclipse: Nabonassar 27, Thoth 29/30 = 19/20 March 721 BCE', () => {
    // Almagest IV.6: the lunar eclipse in the first year of Mardokempad (Merodach-baladan).
    expect(formatInCalendar('egyptian', on(-720, 3, 19, 'julian'))).toBe('29 Thoth 27 Nab.');
    expect(formatInCalendar('egyptian', on(-720, 3, 20, 'julian'))).toBe('30 Thoth 27 Nab.');
  });

  it('ends each year with five extra days, drifting a day every four years', () => {
    const lastDay = jd(yearSpan('egyptian', 27).end - 1);
    expect(formatInCalendar('egyptian', lastDay)).toBe('extra day 5, 27 Nab.');
    expect(yearSpan('egyptian', 5).start - yearSpan('egyptian', 1).start).toBe(4 * 365);
  });
});

describe('Roman years from the founding', () => {
  it('counts 753 BCE as 1 AUC and 1 CE as 754 AUC', () => {
    expect(yearContaining('roman', on(-752, 6, 1, 'julian'))).toBe(1);
    expect(formatInCalendar('roman', on(1, 1, 1, 'julian'))).toBe('1 January 754 AUC');
    expect(yearSpan('roman', 754).start).toBe(on(1, 1, 1, 'julian'));
  });
});

describe('western years', () => {
  it('use the Julian calendar to 1582 and the Gregorian after', () => {
    expect(yearSpan('western', 1582)).toEqual({
      start: on(1582, 1, 1, 'julian'),
      end: on(1583, 1, 1, 'gregorian'),
    });
    expect(formatInCalendar('western', on(-586, 7, 29, 'julian'))).toBe('29 July 587 BCE');
    expect(formatCalendarYear('western', 2025)).toBe('2025 CE');
  });
});

describe('every calendar', () => {
  it.each(YEAR_CALENDARS)('%s: each day of a year is in that year', (calendar) => {
    for (const year of [5, 1000, 2500]) {
      const { start, end } = yearSpan(calendar, year);
      expect(yearContaining(calendar, start)).toBe(year);
      expect(yearContaining(calendar, jd(end - 0.25))).toBe(year);
      expect(yearContaining(calendar, end)).toBe(year + 1);
    }
  });
});
