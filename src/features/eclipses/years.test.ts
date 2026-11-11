import { describe, expect, it } from 'vitest';

import { defaultViewState, momentJulianDay, type ViewState } from '../../state/viewState';
import { yearContaining, yearSpan } from '../../time/calendars';
import { barYear, timeInYear, westernYearsOf } from './years';

const base = defaultViewState(new Date('2026-03-15T12:00:00Z'));
const babylonian: ViewState = { ...base, years: 'babylonian' };

describe('barYear', () => {
  it('is the western year, or the year of the calendar picked that holds the moment', () => {
    expect(barYear(base)).toBe(2026);
    expect(barYear(babylonian)).toBe(yearContaining('babylonian', momentJulianDay(base.time)));
  });
});

describe('timeInYear', () => {
  it('keeps the date in western years', () => {
    const moved = timeInYear(base, 1999);
    expect(moved.date.year).toBe(1999);
    expect(moved.date.month).toBe(base.time.date.month);
    expect(moved.date.day).toBe(base.time.date.day);
  });

  it('keeps the days into the year in another calendar', () => {
    const shown = barYear(babylonian);
    const into = momentJulianDay(babylonian.time) - yearSpan('babylonian', shown).start;
    const moved = timeInYear(babylonian, shown - 10);
    const start = yearSpan('babylonian', shown - 10).start;
    expect(momentJulianDay(moved) - start).toBeCloseTo(into, 3);
  });
});

describe('westernYearsOf', () => {
  it('is the year itself in western years', () => {
    expect(westernYearsOf(base, 2026)).toEqual([2026]);
  });

  it('is the one or two western years another calendar’s year spans', () => {
    const years = westernYearsOf(babylonian, barYear(babylonian)) ?? [];
    expect(years.length).toBeGreaterThanOrEqual(1);
    expect(years.length).toBeLessThanOrEqual(2);
  });
});
