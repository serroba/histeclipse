import { describe, expect, it } from 'vitest';

import { babylonianNewYear, NABONASSAR_OFFSET } from './babylonian';
import { CANON, canonYear, leapMonthOf, tabletYears } from './babylonianHistory';
import { julianDay } from './julianDay';
import { astronomicalYear } from './year';

const RD_TO_JD = 1_721_424.5;
const rdOf = (bce: number, month: number, day: number) =>
  julianDay({ year: astronomicalYear(1 - bce), month, day, calendar: 'julian' }) - RD_TO_JD;

describe('leap months from Parker & Dubberstein', () => {
  it('follow the tablets in Nebuchadnezzar’s reign', () => {
    expect(leapMonthOf(601)).toEqual({ kind: 'Addaru II', attested: true }); // year 4
    expect(leapMonthOf(598)).toEqual({ kind: 'Ululu II', attested: true }); // year 7
    expect(leapMonthOf(596)).toEqual({ kind: 'Ululu II', attested: true }); // year 9
    expect(leapMonthOf(591)).toEqual({ kind: 'Addaru II', attested: true }); // year 14
    expect(leapMonthOf(587)).toBeNull(); // year 18: twelve months
  });

  it('mark their reconstructions, and cover only 626–367 BCE', () => {
    expect(leapMonthOf(625)).toEqual({ kind: 'Addaru II', attested: false });
    expect(leapMonthOf(627)).toBeUndefined();
    expect(leapMonthOf(366)).toBeUndefined();
  });
});

describe('Babylonian New Year days', () => {
  // Parker & Dubberstein's tables (1942): 1 Nisannu, Julian dates. They judged 70% of their
  // dates exact and the rest a day off; the crescent computed here agrees to a day.
  it.each([
    [625, 3, 24],
    [610, 4, 9],
    [604, 4, 2],
    [597, 4, 13],
    [588, 4, 4],
    [587, 4, 23],
    [586, 4, 13],
    [575, 4, 12],
    [568, 4, 23],
    [556, 4, 11],
    [522, 3, 27],
    [500, 3, 23],
    [480, 4, 11],
    [450, 4, 10],
    [424, 4, 22],
    [405, 4, 21],
    [380, 4, 15],
    [368, 4, 2],
  ])('in %i BCE fall within a day of %i/%i', (bce, month, day) => {
    const computed = babylonianNewYear(NABONASSAR_OFFSET + 1 - bce) ?? Number.NaN;
    expect(Math.abs(computed - rdOf(bce, month, day))).toBeLessThanOrEqual(1);
  });
});

describe('regnal years on the tablets', () => {
  it('count Nebuchadnezzar’s years from the Nisannu after his accession', () => {
    expect(tabletYears(605)).toEqual([
      { king: 'Nabopolassar', year: 21, alsoYear: null },
      { king: 'Nebuchadnezzar II', year: 0 },
    ]);
    expect(tabletYears(604)).toEqual([{ king: 'Nebuchadnezzar II', year: 1, alsoYear: null }]);
    expect(tabletYears(587)).toEqual([{ king: 'Nebuchadnezzar II', year: 18, alsoYear: null }]);
    expect(tabletYears(568)).toEqual([{ king: 'Nebuchadnezzar II', year: 37, alsoYear: null }]);
  });

  it('agree with Parker & Dubberstein’s tables', () => {
    const at = (bce: number) => tabletYears(bce).at(0);
    expect(at(556)).toMatchObject({ king: 'Neriglissar', year: 4 });
    expect(at(522)).toMatchObject({ king: 'Cambyses', year: 8 });
    expect(at(500)).toMatchObject({ king: 'Darius I', year: 22 });
    expect(at(480)).toMatchObject({ king: 'Xerxes', year: 6 });
    expect(at(424)).toMatchObject({ king: 'Artaxerxes I', year: 41 });
    expect(at(380)).toMatchObject({ king: 'Artaxerxes II', year: 25 });
  });

  it('hold several kings in a year of turmoil', () => {
    expect(tabletYears(556).map(({ king }) => king)).toEqual([
      'Neriglissar',
      'Labashi-Marduk',
      'Nabonidus',
    ]);
    expect(tabletYears(522).map(({ king }) => king)).toEqual([
      'Cambyses',
      'Bardiya',
      'Nebuchadnezzar III',
      'Darius I',
    ]);
  });

  it('give Alexander both counts, and drop the accession year after him', () => {
    expect(tabletYears(330)).toEqual([{ king: 'Alexander the Great', year: 7, alsoYear: 1 }]);
    expect(tabletYears(323)).toEqual([
      { king: 'Alexander the Great', year: 14, alsoYear: 8 },
      { king: 'Philip Arrhidaeus', year: 1, alsoYear: null },
    ]);
    expect(tabletYears(700)).toEqual([]);
  });
});

describe('Ptolemy’s canon', () => {
  it('counts whole Egyptian years from Nabonassar', () => {
    expect(canonYear(1)).toEqual({ king: 'Nabonassar', year: 1 });
    // Almagest IV.6: the eclipse of 721 BCE in the first year of Mardokempados, Nabonassar 27.
    expect(canonYear(27)).toEqual({ king: 'Mardokempados', year: 1 });
    expect(canonYear(123)).toEqual({ king: 'Nabopolassaros', year: 1 });
    expect(canonYear(161)).toEqual({ king: 'Nabokolassaros', year: 18 });
    const total = CANON.reduce((sum, [, years]) => sum + years, 0);
    expect(canonYear(total)?.king).toBe('Alexandros');
    expect(canonYear(total + 1)).toBeNull();
    expect(canonYear(0)).toBeNull();
  });
});
