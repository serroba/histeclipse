import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { roundMa } from '../deepTime/scale';
import {
  axisOf,
  clampAxis,
  EARTH_FIRST,
  fitAxis,
  maOfYear,
  modelOf,
  momentAt,
  NARROWEST_DEEP,
  NARROWEST_YEARS,
  panAxis,
  presetOf,
  presetWindow,
  spanFor,
  windowOfView,
  yearOfMa,
  YEARS_FIRST,
  zoomAxis,
  type AxisWindow,
} from './timeAxis';

const NOW = 2026;

describe('one time axis over the years and deep time (#1073)', () => {
  it('Given Ma, Then they sit before 1950 on the axis of astronomical years, and back', () => {
    expect(yearOfMa(0)).toBe(1950);
    expect(yearOfMa(0.021)).toBe(-19050);
    expect(maOfYear(-19050)).toBeCloseTo(0.021, 12);
    expect(EARTH_FIRST).toBe(1950 - 4568e6);
  });

  it('Given the four spans, Then each is a window to today, and is known again as itself', () => {
    expect(presetWindow('years', NOW)).toEqual({ first: -9699, last: NOW });
    expect(presetWindow('ice', NOW)).toEqual({ first: 1950 - 2.6e6, last: NOW });
    expect(presetWindow('all', NOW)).toEqual({ first: 1950 - 540e6, last: NOW });
    expect(presetWindow('all', NOW, 500)).toEqual({ first: 1950 - 500e6, last: NOW });
    expect(presetWindow('eons', NOW)).toEqual({ first: EARTH_FIRST, last: NOW });
    for (const span of ['years', 'ice', 'all', 'eons'] as const) {
      expect(presetOf(presetWindow(span, NOW), NOW)).toBe(span);
      expect(spanFor(presetWindow(span, NOW), NOW)).toBe(span);
    }
    expect(presetOf({ first: -5000, last: NOW }, NOW)).toBeNull();
  });

  it('Given a window, Then it is read in the years wholly within the Holocene, else in deep time', () => {
    expect(modelOf({ first: YEARS_FIRST, last: NOW })).toBe('years');
    expect(modelOf({ first: 1854, last: NOW })).toBe('years');
    expect(modelOf({ first: YEARS_FIRST - 1, last: NOW })).toBe('deep');
    // Ancient Australia's 120–80 Ma: deep time, on the 540 Myr span's bar.
    const australia = { first: yearOfMa(120), last: yearOfMa(80) };
    expect(modelOf(australia)).toBe('deep');
    expect(spanFor(australia, NOW)).toBe('all');
    expect(spanFor({ first: yearOfMa(1), last: NOW }, NOW)).toBe('ice');
    expect(spanFor({ first: yearOfMa(3000), last: yearOfMa(2000) }, NOW)).toBe('eons');
  });

  it('Given a point, Then its moment is a whole year in the years, and Ma to a thousand years in deep time', () => {
    expect(momentAt(-584.4, { first: -1000, last: 0 })).toEqual({ model: 'years', year: -584 });
    const deep = { first: yearOfMa(2.6), last: NOW };
    expect(momentAt(yearOfMa(0.0214), deep)).toEqual({ model: 'deep', ma: 0.021 });
    // After 1950, deep time's present: 0 Ma, never negative.
    expect(momentAt(2000, deep)).toEqual({ model: 'deep', ma: 0 });
    expect(axisOf({ ma: null, year: -584 })).toBe(-584);
    expect(axisOf({ ma: 0.315, year: 2026 })).toBe(1950 - 315000);
  });

  it('Given a zoom into the Holocene from the ice ages, Then it hands over to the years at 9700 BCE', () => {
    let window: AxisWindow = presetWindow('ice', NOW);
    const steps: string[] = [];
    while (modelOf(window) === 'deep') {
      window = zoomAxis(window, NOW, 0.5, NOW);
      steps.push(modelOf(window));
    }
    expect(window.first).toBeGreaterThanOrEqual(YEARS_FIRST);
    expect(window.last).toBe(NOW);
    expect(steps.at(-1)).toBe('years');
    // And out again: back into deep time, its start on a thousand years.
    const out = zoomAxis(window, NOW, 4, NOW);
    expect(modelOf(out)).toBe('deep');
    expect(roundMa(maOfYear(out.first))).toBeCloseTo(maOfYear(out.first), 9);
  });

  it('Given a window narrower than its model reads, Then it widens within that model', () => {
    // A decade's least in the years, kept on the years' side of 9700 BCE.
    expect(clampAxis({ first: -9699, last: -9697 }, NOW)).toEqual({ first: -9699, last: -9689 });
    expect(clampAxis({ first: 2020, last: 2026 }, NOW)).toEqual({ first: 2016, last: 2026 });
    // Ten thousand years' least in deep time.
    const deep = clampAxis({ first: yearOfMa(66.0005), last: yearOfMa(66) }, NOW);
    expect(modelOf(deep)).toBe('deep');
    expect(deep.last - deep.first).toBeGreaterThanOrEqual(NARROWEST_DEEP);
  });

  it('Given an interval to fit, Then it is padded a tenth each side; a single moment gets the narrowest', () => {
    // Ancient Australia (#749): 120–80 Ma, shown 124–76 Ma.
    const australia = fitAxis({ first: yearOfMa(120), last: yearOfMa(80) }, NOW);
    expect(maOfYear(australia.first)).toBeCloseTo(124, 6);
    expect(maOfYear(australia.last)).toBeCloseTo(76, 6);
    // ENSO's 1854–2026: the padding stops at today.
    expect(fitAxis({ first: 1854, last: 2026 }, NOW)).toEqual({ first: 1837, last: 2026 });
    // The eclipse of Thales, a single year.
    expect(fitAxis({ first: -584, last: -584 }, NOW)).toEqual({ first: -589, last: -579 });
  });

  it('Given the view as links have it today, Then its window is the Years bar’s, or the span’s', () => {
    expect(windowOfView({ ma: null, deepScale: 'all', yearsWindow: null }, NOW)).toEqual(
      presetWindow('years', NOW),
    );
    const enso = { first: 1854, last: 2026 };
    expect(windowOfView({ ma: null, deepScale: 'all', yearsWindow: enso }, NOW)).toBe(enso);
    expect(windowOfView({ ma: 0.315, deepScale: 'ice', yearsWindow: enso }, NOW)).toEqual(
      presetWindow('ice', NOW),
    );
  });

  describe('properties', () => {
    const point = fc.double({ min: EARTH_FIRST, max: NOW, noNaN: true });
    const window = fc.tuple(point, point).map(([a, b]) => ({ first: a, last: b }));

    it('Then a clamped window is on the axis, at least its model’s narrowest, and clamps to itself', () => {
      fc.assert(
        fc.property(window, (raw) => {
          const held = clampAxis(raw, NOW);
          expect(held.first).toBeGreaterThanOrEqual(EARTH_FIRST);
          expect(held.last).toBeLessThanOrEqual(NOW);
          const narrowest = modelOf(held) === 'years' ? NARROWEST_YEARS : NARROWEST_DEEP;
          expect(held.last - held.first).toBeGreaterThanOrEqual(narrowest);
          expect(clampAxis(held, NOW)).toEqual(held);
        }),
      );
    });

    it('Then zooming about a point inside keeps that point inside', () => {
      fc.assert(
        fc.property(
          window,
          fc.double({ min: 0, max: 1, noNaN: true }),
          fc.double({ min: 0.1, max: 10, noNaN: true }),
          (raw, share, factor) => {
            const held = clampAxis(raw, NOW);
            const around = held.first + (held.last - held.first) * share;
            const zoomed = zoomAxis(held, around, factor, NOW);
            // Rounding to a model's step can move an end by up to a step.
            const step = modelOf(zoomed) === 'years' ? 1 : 1000;
            expect(zoomed.first).toBeLessThanOrEqual(around + step);
            expect(zoomed.last).toBeGreaterThanOrEqual(Math.min(around, NOW) - step);
          },
        ),
      );
    });

    it('Then panning keeps the width, unless an end of the axis stops it', () => {
      fc.assert(
        fc.property(window, fc.double({ min: -1e9, max: 1e9, noNaN: true }), (raw, years) => {
          const held = clampAxis(raw, NOW);
          const moved = panAxis(held, years, NOW);
          expect(moved.first).toBeGreaterThanOrEqual(EARTH_FIRST);
          expect(moved.last).toBeLessThanOrEqual(NOW);
        }),
      );
    });
  });
});
