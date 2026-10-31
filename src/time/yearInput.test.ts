import { describe, expect, it } from 'vitest';

import { calendarDateOf } from './julianDay';
import { astronomicalYear } from './year';
import { moveToYear, parseYearInput } from './yearInput';

describe('parseYearInput', () => {
  it.each([
    ['621 BCE', -620],
    ['621 bc', -620],
    ['621BCE', -620],
    ['621 B.C.', -620],
    ['621 B.C.E.', -620],
    ['1 BCE', 0],
    ['-620', -620],
    ['0', 0],
    ['2025', 2025],
    ['2025 CE', 2025],
    ['AD 2025', 2025],
    ['2025 A.D.', 2025],
    ['  587   BCE ', -586],
  ])('reads %s as %i', (text, year) => {
    expect(parseYearInput(text)).toBe(year);
  });

  it.each(['', 'soon', '621 BCE BCE', '-620 BCE', 'AD 5 BC', '0 BCE', 'AD 0', '12.5'])(
    'rejects %s',
    (text) => {
      expect(() => parseYearInput(text)).toThrow(RangeError);
    },
  );
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
