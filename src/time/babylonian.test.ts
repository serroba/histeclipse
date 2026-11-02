import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  babylonianDate,
  babylonianNewYear,
  babylonianYearOf,
  NABONASSAR_OFFSET,
} from './babylonian';
import { formatInCalendar, shortDate, yearContaining, yearSpan } from './calendars';
import { julianDay, julianDayNumber } from './julianDay';
import { astronomicalYear } from './year';

const RD_TO_JD = 1_721_424.5;
const rdOf = (year: number, month: number, day: number) =>
  julianDay({ year: astronomicalYear(year), month, day, calendar: 'julian' }) - RD_TO_JD;
/** The Nabonassar year that begins in spring of a year BCE. */
const nabonassar = (bce: number) => 1 - bce + NABONASSAR_OFFSET;

describe('Babylonian calendar', () => {
  it('begins the Seleucid Era on 1 Nisannu, 3 April 311 BCE', () => {
    expect(babylonianDate(rdOf(-310, 4, 3))).toMatchObject({
      year: nabonassar(311),
      monthName: 'Nisannu',
      day: 1,
      seleucidYear: 1,
      leapUncertain: false,
    });
    expect(babylonianNewYear(nabonassar(311))).toBe(rdOf(-310, 4, 3));
  });

  it('puts Alexander’s death, 29 Ayyaru, on 11 June 323 BCE', () => {
    // Astronomical diary: "Ayyaru 29: the king died". A second Addaru preceded that Nisannu.
    expect(babylonianDate(rdOf(-322, 6, 11))).toMatchObject({ monthName: 'Ayyaru', day: 29 });
    expect(babylonianDate(rdOf(-322, 3, 16))).toMatchObject({ monthName: 'Addaru II', day: 1 });
    // After the Persian kings: no Old Persian names; under Darius I, there are.
    expect(babylonianDate(rdOf(-322, 6, 11))?.persianName).toBeNull();
    expect(babylonianDate(rdOf(-519, 6, 11))?.persianName).toMatch(/^(Θūravāhara|Θāigarciš)$/);
  });

  it('dates Nebuchadnezzar’s year 37 (VAT 4956) from 1 Nisannu, 23 April 568 BCE', () => {
    expect(babylonianDate(rdOf(-567, 4, 23))).toMatchObject({
      year: nabonassar(568),
      monthName: 'Nisannu',
      day: 1,
      leapUncertain: true,
      persianName: null,
      seleucidYear: null,
    });
  });

  it('adds a second Ululu in year 17 of the cycle', () => {
    // Nabonassar 454 (294/293 BCE): 454 = 19 × 23 + 17.
    const year = 454;
    const start = babylonianNewYear(year) ?? Number.NaN;
    const names = new Set<string>();
    for (let day = start; day < (babylonianNewYear(year + 1) ?? start); day += 10) {
      names.add(babylonianDate(day)?.monthName ?? '');
    }
    expect([...names]).toContain('Ululu II');
    expect([...names]).not.toContain('Addaru II');
  });

  it('flags months whose crescent was a close call', () => {
    const flags = new Set<boolean>();
    for (let day = rdOf(-500, 1, 1); day < rdOf(-480, 1, 1); day += 29) {
      flags.add(babylonianDate(day)?.dayUncertain ?? false);
    }
    expect([...flags].sort()).toEqual([false, true]);
  });

  it('knows nothing outside the computed whole years', () => {
    expect(babylonianDate(rdOf(-800, 1, 1))).toBeNull();
    expect(babylonianYearOf(rdOf(200, 1, 1))).toBeNull();
    expect(babylonianNewYear(-10)).toBeNull();
    expect(babylonianNewYear(5000)).toBeNull();
  });
});

describe('Babylonian dates written out', () => {
  const at = (year: number, month: number, day: number) =>
    julianDay({ year: astronomicalYear(year), month, day, calendar: 'julian' });

  it('give the year from Nabonassar, its western years, and what is uncertain', () => {
    // Babylonian Chronicle (ABC 5): Jerusalem taken on 2 Addaru, Nebuchadnezzar's year 7.
    expect(formatInCalendar('babylonian', at(-596, 3, 16))).toBe(
      '2 Addaru 150 Bab. (598/597 BCE) · leap months by the 19-year cycle run back',
    );
    expect(shortDate('babylonian', at(-596, 3, 16))).toBe('2 Addaru');
  });

  it('add the Seleucid year, and Old Persian names under the Persian kings', () => {
    expect(formatInCalendar('babylonian', at(-310, 4, 3))).toBe(
      '1 Nisannu 437 Bab. (311/310 BCE) · SE 1',
    );
    expect(formatInCalendar('babylonian', at(-519, 6, 11))).toMatch(
      /^\d+ \w+ \(\S+\) 228 Bab\. \(520\/519 BCE\)/,
    );
  });

  it('give the year only outside the computed months', () => {
    expect(formatInCalendar('babylonian', at(500, 6, 1))).toBe(
      '1247 Bab. (by 1 January; months not computed)',
    );
    expect(shortDate('babylonian', at(500, 6, 1))).toBe('');
    expect(yearSpan('babylonian', 1247).start).toBe(at(500, 1, 1));
  });
});

describe('Babylonian years', () => {
  it('hold every day, across both ends of the computed months', () => {
    const edges = [yearSpan('babylonian', 5).start, yearSpan('babylonian', 840).start];
    fc.assert(
      fc.property(
        fc.constantFrom(...edges),
        fc.integer({ min: -2000, max: 2000 }),
        (edge, offset) => {
          const moment = julianDayNumber(edge + offset);
          const { start, end } = yearSpan('babylonian', yearContaining('babylonian', moment));
          expect(start <= moment && moment < end).toBe(true);
        },
      ),
    );
  });
});
