import { describe, expect, it } from 'vitest';

import type { LunarEclipse } from '../data/lunarCatalog';
import { calendarDateOf, julianDayNumber } from '../time/julianDay';
import { astronomicalYear } from '../time/year';
import { describeLunarEclipse, eclipseMoment, eclipseSelection, findSelected } from './lunar';

const day = (year: number, month: number, date: number, calendar: 'julian' | 'gregorian') =>
  calendarDateOf(astronomicalYear(year), month, date, calendar);

function eclipse(overrides: Partial<LunarEclipse>): LunarEclipse {
  return {
    jdTT: julianDayNumber(2_460_748.79161),
    kind: 'total',
    umbralMagnitude: 1.1795,
    penumbralMagnitude: 2.2616,
    gamma: 0.3479,
    deltaT: 69,
    sublunar: [2.68, -102.25],
    ...overrides,
  };
}

// 2025 March 14: NASA gives greatest eclipse at 06:59:56 TD, i.e. 06:58:47 UT.
const MARCH_2025 = eclipse({});
// 621 BCE April 22 (Julian), ΔT 18,776 s.
const APRIL_621_BCE = eclipse({ jdTT: julianDayNumber(1_494_714.805964), deltaT: 18_776 });

describe('eclipseMoment', () => {
  it('gives greatest eclipse in UT, to the minute', () => {
    expect(eclipseMoment(MARCH_2025)).toEqual({
      date: day(2025, 3, 14, 'gregorian'),
      minuteOfDay: 6 * 60 + 59,
    });
  });

  it('uses the Julian calendar before 1582 and subtracts the large ancient ΔT', () => {
    // 07:20:35 TT minus 5 h 12 min 56 s.
    expect(eclipseMoment(APRIL_621_BCE)).toEqual({
      date: day(-620, 4, 22, 'julian'),
      minuteOfDay: 2 * 60 + 8,
    });
  });

  it('rolls over to the next day when rounding reaches midnight', () => {
    // 2000 January 1, 23:59:40 UT (ΔT 0 to keep the arithmetic visible).
    const lateNight = eclipse({ jdTT: julianDayNumber(2_451_545.49977), deltaT: 0 });
    expect(eclipseMoment(lateNight)).toEqual({
      date: day(2000, 1, 2, 'gregorian'),
      minuteOfDay: 0,
    });
  });
});

describe('selection', () => {
  it('selects an eclipse by its UT day', () => {
    expect(eclipseSelection(APRIL_621_BCE)).toEqual({
      kind: 'lunar',
      date: day(-620, 4, 22, 'julian'),
    });
  });

  it('finds the selected eclipse, whatever calendar the date is written in', () => {
    const eclipses = [MARCH_2025, APRIL_621_BCE];
    expect(findSelected(eclipses, { kind: 'lunar', date: day(-620, 4, 22, 'julian') })).toBe(
      APRIL_621_BCE,
    );
    // The same day in the proleptic Gregorian calendar.
    expect(findSelected(eclipses, { kind: 'lunar', date: day(-620, 4, 15, 'gregorian') })).toBe(
      APRIL_621_BCE,
    );
  });

  it('finds nothing for other days, solar selections, or no selection', () => {
    const eclipses = [MARCH_2025];
    expect(
      findSelected(eclipses, { kind: 'lunar', date: day(2025, 3, 15, 'gregorian') }),
    ).toBeUndefined();
    expect(
      findSelected(eclipses, { kind: 'solar', date: day(2025, 3, 14, 'gregorian') }),
    ).toBeUndefined();
    expect(findSelected(eclipses, null)).toBeUndefined();
  });
});

describe('describeLunarEclipse', () => {
  it.each([
    [MARCH_2025, 'Total lunar eclipse', 'umbral magnitude 1.18'],
    [
      eclipse({ kind: 'partial', umbralMagnitude: 0.1491 }),
      'Partial lunar eclipse',
      'umbral magnitude 0.15',
    ],
    [
      eclipse({ kind: 'penumbral', umbralMagnitude: -0.95, penumbralMagnitude: 0.0139 }),
      'Penumbral lunar eclipse',
      'penumbral magnitude 0.01',
    ],
  ])('describes %#', (input, title, depth) => {
    expect(describeLunarEclipse(input)).toEqual({ title, depth });
  });
});
