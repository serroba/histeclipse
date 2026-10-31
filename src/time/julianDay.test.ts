import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import shared from '../../test-vectors/julian-day.json';
import {
  GREGORIAN_REFORM_JD,
  calendarDate,
  calendarDateOf,
  daysInMonth,
  historicalCalendar,
  isLeapYear,
  julianDay,
  julianDayNumber,
  type Calendar,
  type CalendarDate,
} from './julianDay';
import { astronomicalYear } from './year';

function toCalendar(value: string): Calendar {
  if (value === 'julian' || value === 'gregorian') return value;
  throw new Error(`Unknown calendar ${value}`);
}

const meeus = shared.vectors.map((vector) => ({
  date: calendarDateOf(
    astronomicalYear(vector.year),
    vector.month,
    vector.day,
    toCalendar(vector.calendar),
  ),
  jd: julianDayNumber(vector.jd),
}));

const calendars = fc.constantFrom<Calendar>('julian', 'gregorian');
// Day numbers covering roughly 4700 BCE to 3800 CE, matching the Python property tests.
const dayNumbers = fc.integer({ min: 1, max: 3_100_000 });

describe('julianDay', () => {
  it('loads every shared vector', () => {
    expect(meeus).toHaveLength(18);
  });

  it.each(meeus)('converts $date.year-$date.month-$date.day ($date.calendar)', ({ date, jd }) => {
    expect(julianDay(date)).toBeCloseTo(jd, 9);
  });

  it('rejects dates before Julian Day 0', () => {
    const date = calendarDateOf(astronomicalYear(-4713), 12, 31, 'julian');
    expect(() => julianDay(date)).toThrow(RangeError);
  });

  it('puts 1582-10-15 (Gregorian) the day after 1582-10-04 (Julian)', () => {
    const lastJulian = julianDay(calendarDateOf(astronomicalYear(1582), 10, 4, 'julian'));
    const firstGregorian = julianDay(calendarDateOf(astronomicalYear(1582), 10, 15, 'gregorian'));
    expect(firstGregorian).toBe(GREGORIAN_REFORM_JD);
    expect(firstGregorian - lastJulian).toBe(1);
  });
});

describe('calendarDate', () => {
  it.each(meeus)('inverts $jd', ({ date, jd }) => {
    const result = calendarDate(jd, date.calendar);
    expect([result.year, result.month, result.calendar]).toEqual([
      date.year,
      date.month,
      date.calendar,
    ]);
    expect(result.day).toBeCloseTo(date.day, 6);
  });

  it('round-trips midnight of every day', () => {
    fc.assert(
      fc.property(dayNumbers, calendars, (dayNumber, calendar) => {
        const midnight = julianDayNumber(dayNumber - 0.5);
        expect(julianDay(calendarDate(midnight, calendar))).toBe(midnight);
      }),
    );
  });

  it('maps consecutive days to consecutive dates', () => {
    fc.assert(
      fc.property(dayNumbers, calendars, (dayNumber, calendar) => {
        const today = calendarDate(julianDayNumber(dayNumber - 0.5), calendar);
        const tomorrow = calendarDate(julianDayNumber(dayNumber + 0.5), calendar);
        const expected: [number, number, number] =
          today.day < daysInMonth(today.year, today.month, calendar)
            ? [today.year, today.month, today.day + 1]
            : today.month < 12
              ? [today.year, today.month + 1, 1]
              : [today.year + 1, 1, 1];
        expect([tomorrow.year, tomorrow.month, tomorrow.day]).toEqual(expected);
      }),
    );
  });

  it('round-trips fractions of a day', () => {
    fc.assert(
      fc.property(dayNumbers, fc.constantFrom(0, 0.25, 0.5, 0.75), calendars, (n, f, calendar) => {
        const jd = julianDayNumber(n + f);
        expect(julianDay(calendarDate(jd, calendar))).toBeCloseTo(jd, 6);
      }),
    );
  });
});

describe('calendar rules', () => {
  it.each<[number, Calendar, boolean]>([
    [1900, 'julian', true],
    [1900, 'gregorian', false],
    [2000, 'gregorian', true],
    [2023, 'gregorian', false],
    [0, 'julian', true],
    [-4, 'julian', true],
    [-1, 'julian', false],
    [-100, 'gregorian', false],
    [-400, 'gregorian', true],
  ])('leap year %i (%s) is %s', (year, calendar, expected) => {
    expect(isLeapYear(astronomicalYear(year), calendar)).toBe(expected);
  });

  it.each([
    [0, 1],
    [13, 1],
    [1.5, 1],
    [2, 30],
    [4, 31],
    [1, 0.5],
    [1, 32],
    [1, Number.NaN],
  ])('rejects month %d day %d', (month, day) => {
    expect(() => calendarDateOf(astronomicalYear(2001), month, day, 'gregorian')).toThrow(
      RangeError,
    );
  });

  it('accepts February 29 only in leap years', () => {
    const year = astronomicalYear(1900);
    const date: CalendarDate = calendarDateOf(year, 2, 29, 'julian');
    expect(date.day).toBe(29);
    expect(() => calendarDateOf(year, 2, 29, 'gregorian')).toThrow(RangeError);
  });

  it('uses the Julian calendar before the reform and Gregorian after', () => {
    expect(historicalCalendar(julianDayNumber(GREGORIAN_REFORM_JD - 1))).toBe('julian');
    expect(historicalCalendar(GREGORIAN_REFORM_JD)).toBe('gregorian');
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects Julian Day %d', (value) => {
    expect(() => julianDayNumber(value)).toThrow(RangeError);
  });
});
