import { describe, expect, it } from 'vitest';

import type { Moment } from '../state/viewState';
import { formatCalendar, formatDate, formatDuration, formatTimeOfDay } from './format';
import { calendarDateOf } from './julianDay';
import { astronomicalYear } from './year';

const babylon: Moment = {
  date: calendarDateOf(astronomicalYear(-620), 4, 22, 'julian'),
  minuteOfDay: 7 * 60 + 5,
};

describe('formatting', () => {
  it('writes dates with the era', () => {
    expect(formatDate(babylon)).toBe('22 April 621 BCE');
    expect(
      formatDate({
        date: calendarDateOf(astronomicalYear(2025), 12, 1, 'gregorian'),
        minuteOfDay: 0,
      }),
    ).toBe('1 December 2025 CE');
  });

  it('writes the time of day in UT', () => {
    expect(formatTimeOfDay(babylon)).toBe('07:05 UT');
    expect(formatTimeOfDay({ ...babylon, minuteOfDay: 1439 })).toBe('23:59 UT');
  });

  it('names the calendar', () => {
    expect(formatCalendar(babylon)).toBe('Julian calendar');
  });

  it.each([
    [69.2, '69 s'],
    [-2, '−2 s'],
    [476, '8 min'],
    [3540, '59 min'],
    [3600, '1 h'],
    [18_781, '5 h 13 min'],
    [-7200, '−2 h'],
  ])('writes %d seconds as %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});
