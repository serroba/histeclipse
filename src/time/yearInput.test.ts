import { describe, expect, it } from 'vitest';

import { calendarDateOf } from './julianDay';
import { astronomicalYear } from './year';
import { moveToYear, parseYearNumber } from './yearInput';

describe('parseYearNumber', () => {
  it.each([
    ['621', 'BCE', -620],
    ['1', 'BCE', 0],
    ['1', 'CE', 1],
    ['2025', 'CE', 2025],
    [' 587 ', 'BCE', -586],
  ] as const)('reads %s %s as %i', (text, era, year) => {
    expect(parseYearNumber(text, era)).toBe(year);
  });

  it.each(['', 'soon', '-620', '621 BCE', '12.5', '123456'])('rejects %s', (text) => {
    expect(() => parseYearNumber(text, 'CE')).toThrow('Type the year as a number');
  });

  it('rejects year 0, which neither era has', () => {
    expect(() => parseYearNumber('0', 'BCE')).toThrow('There is no year 0');
  });
});

describe('moveToYear', () => {
  const at = (year: number, month: number, day: number, calendar: 'julian' | 'gregorian') =>
    calendarDateOf(astronomicalYear(year), month, day, calendar);

  it('keeps the day, month and time of day', () => {
    const moved = moveToYear(
      { date: at(2025, 3, 14, 'gregorian'), minuteOfDay: 419 },
      astronomicalYear(2026),
    );
    expect(moved).toEqual({ date: at(2026, 3, 14, 'gregorian'), minuteOfDay: 419 });
  });

  it('switches to the Julian calendar before the 1582 reform', () => {
    const moved = moveToYear(
      { date: at(2025, 4, 22, 'gregorian'), minuteOfDay: 0 },
      astronomicalYear(-620),
    );
    expect(moved.date).toEqual(at(-620, 4, 22, 'julian'));
  });

  it('turns February 29 into February 28 when the year has no leap day', () => {
    const moved = moveToYear(
      { date: at(2024, 2, 29, 'gregorian'), minuteOfDay: 0 },
      astronomicalYear(2025),
    );
    expect(moved.date).toEqual(at(2025, 2, 28, 'gregorian'));
  });
});
