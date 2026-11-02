import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { formatInCalendar, shortDate, yearContaining, yearSpan } from './calendars';
import { chineseCoverage, chineseDate, dayCycle, HUANGDI_OFFSET, yearCycle } from './chinese';
import { julianDay, julianDayNumber } from './julianDay';
import { astronomicalYear } from './year';

const on = (year: number, month: number, day: number, calendar: 'julian' | 'gregorian') =>
  julianDay({ year: astronomicalYear(year), month, day, calendar });
const RD_TO_JD = 1_721_424.5;
const rdOf = (year: number, month: number, day: number, calendar: 'julian' | 'gregorian') =>
  on(year, month, day, calendar) - RD_TO_JD;

describe('Chinese calendar', () => {
  it('begins its years on the published New Year days', () => {
    // Hong Kong Observatory: 10 Feb 2024, 29 Jan 2025, 22 Jan 2023, 16 Feb 2018.
    expect(yearSpan('chinese', 2024 + HUANGDI_OFFSET).start).toBe(on(2024, 2, 10, 'gregorian'));
    expect(yearSpan('chinese', 2025 + HUANGDI_OFFSET).start).toBe(on(2025, 1, 29, 'gregorian'));
    expect(yearSpan('chinese', 2023 + HUANGDI_OFFSET).start).toBe(on(2023, 1, 22, 'gregorian'));
    expect(yearSpan('chinese', 2018 + HUANGDI_OFFSET).start).toBe(on(2018, 2, 16, 'gregorian'));
  });

  it('places the leap months', () => {
    expect(chineseDate(rdOf(2023, 3, 22, 'gregorian'))).toMatchObject({
      month: 2,
      leap: true,
      day: 1,
      monthName: 'leap 2nd month',
    });
    expect(chineseDate(rdOf(2023, 3, 21, 'gregorian'))).toMatchObject({ month: 2, leap: false });
    expect(chineseDate(rdOf(2025, 7, 25, 'gregorian'))).toMatchObject({ month: 6, leap: true });
    expect(chineseDate(rdOf(2033, 12, 22, 'gregorian'))).toMatchObject({ month: 11, leap: true });
  });

  it('names years and days in the sixty-fold cycle', () => {
    expect(yearCycle(2024 + HUANGDI_OFFSET)).toMatchObject({
      characters: '甲辰',
      pinyin: 'jiǎchén',
      sign: 'Wood Dragon',
    });
    expect(yearCycle(1984 + HUANGDI_OFFSET)).toMatchObject({ index: 0, sign: 'Wood Rat' });
    expect(yearCycle(1983 + HUANGDI_OFFSET)).toMatchObject({
      characters: '癸亥',
      sign: 'Water Pig',
    });
    expect(dayCycle(rdOf(2000, 1, 1, 'gregorian'))).toMatchObject({
      characters: '戊午',
      pinyin: 'wùwǔ',
    });
    // Sixty days on, the same name; one day on, the next.
    const day = rdOf(-719, 2, 22, 'julian');
    expect(dayCycle(day + 60).index).toBe(dayCycle(day).index);
    expect(dayCycle(day + 1).index).toBe((dayCycle(day).index + 1) % 60);
  });

  it('writes a date with its year and day names', () => {
    expect(formatInCalendar('chinese', on(2024, 2, 10, 'gregorian'))).toBe(
      '1st month, day 1, 4721 HE (甲辰 jiǎchén, Wood Dragon) · day 甲辰 jiǎchén',
    );
    expect(shortDate('chinese', on(2024, 2, 11, 'gregorian'))).toBe('1st month 2');
  });

  it('gives only the cycle names outside the computed months', () => {
    const { first, last } = chineseCoverage();
    expect([first - HUANGDI_OFFSET, last - HUANGDI_OFFSET]).toEqual([-720, 2099]);
    const early = on(-1000, 6, 1, 'julian');
    expect(formatInCalendar('chinese', early)).toMatch(
      /^\S+ \S+ year \(by 1 January; months not computed\) · day \S+ \S+$/,
    );
    expect(shortDate('chinese', early)).toBe(dayCycle(early - RD_TO_JD).characters);
    expect(yearContaining('chinese', early)).toBe(-1000 + HUANGDI_OFFSET);
  });

  it('keeps every day in the year that contains it, across the ends of the table', () => {
    const { first, last } = chineseCoverage();
    const edges = [yearSpan('chinese', first).start, yearSpan('chinese', last + 1).start];
    fc.assert(
      fc.property(
        fc.constantFrom(...edges),
        fc.integer({ min: -800, max: 800 }),
        (edge, offset) => {
          const moment = julianDayNumber(edge + offset);
          const year = yearContaining('chinese', moment);
          const { start, end } = yearSpan('chinese', year);
          expect(start <= moment && moment < end).toBe(true);
        },
      ),
    );
  });
});
