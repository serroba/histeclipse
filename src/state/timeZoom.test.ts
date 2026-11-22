import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { EARTH_FIRST, presetWindow, yearOfMa, YEARS_FIRST } from './timeAxis';
import { deepAxisWindow, targetOf, ZOOM_STEP, zoomRoom, zoomTarget } from './timeZoom';

const PRESENT = 2026;
const TRACK = presetWindow('years', PRESENT);

describe('zooming the time bar (#1074)', () => {
  it('Given a window of years, When zoomed in about a year, Then it narrows about that year, still in the years', () => {
    const target = zoomTarget(TRACK, 1000, 1 / ZOOM_STEP, PRESENT);
    expect(target.model).toBe('years');
    if (target.model !== 'years') return;
    expect(target.window.first).toBeGreaterThan(TRACK.first);
    expect(target.window.last).toBeLessThan(TRACK.last);
    expect(target.window.first).toBeLessThanOrEqual(1000);
    expect(target.window.last).toBeGreaterThanOrEqual(1000);
  });

  it('Given the whole Holocene track, When zoomed out, Then it goes on into the ice ages at the same moment', () => {
    const target = zoomTarget(TRACK, 2000, ZOOM_STEP, PRESENT);
    expect(target).toMatchObject({ model: 'deep', scale: 'ice', ma: 0 });
    if (target.model !== 'deep') return;
    expect(target.window?.youngest).toBe(0);
    expect(target.window?.oldest).toBeGreaterThan(0.0117);
    expect(target.window?.oldest).toBeLessThan(2.6);
  });

  it('Given the ice ages at today, When zoomed in far enough, Then they come back to the years', () => {
    let window = presetWindow('ice', PRESENT);
    let target = targetOf(window, PRESENT, PRESENT);
    for (let step = 0; step < 20 && target.model === 'deep'; step += 1) {
      target = zoomTarget(window, PRESENT, 1 / ZOOM_STEP, PRESENT);
      window =
        target.model === 'deep' && target.window !== null
          ? deepAxisWindow(target.window, PRESENT)
          : window;
    }
    expect(target.model).toBe('years');
  });

  it('Given the whole ice ages, When zoomed out, Then the 540 Myr span shows part of itself, and zoomed out again, all of Earth', () => {
    const ice = zoomTarget(presetWindow('ice', PRESENT), yearOfMa(0.02), ZOOM_STEP, PRESENT);
    expect(ice).toMatchObject({ model: 'deep', scale: 'all', ma: 0.02 });
    const all = zoomTarget(presetWindow('all', PRESENT), yearOfMa(100), 100, PRESENT);
    expect(all).toEqual({ model: 'deep', scale: 'eons', window: null, ma: 100 });
  });

  it('Given part of the Cretaceous, Then its window reads back as the link has it', () => {
    const target = targetOf(
      deepAxisWindow({ oldest: 124, youngest: 76 }, PRESENT),
      yearOfMa(100),
      PRESENT,
    );
    expect(target).toEqual({
      model: 'deep',
      scale: 'all',
      window: { oldest: 124, youngest: 76 },
      ma: 100,
    });
  });

  it('Given any window and moment in it, When zoomed, Then the moment stays on the bar, within a thousand years', () => {
    fc.assert(
      fc.property(
        fc.double({ min: EARTH_FIRST, max: PRESENT - 20, noNaN: true }),
        fc.double({ min: 0.01, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.constantFrom(1 / ZOOM_STEP, ZOOM_STEP, 0.9, 1.3),
        (first, share, at, factor) => {
          const window = { first, last: first + (PRESENT - first) * share };
          const around = window.first + (window.last - window.first) * at;
          const target = zoomTarget(window, around, factor, PRESENT);
          if (target.model === 'years') {
            expect(target.window.first).toBeGreaterThanOrEqual(YEARS_FIRST);
            expect(target.window.first).toBeLessThanOrEqual(Math.ceil(around) + 10);
            expect(target.window.last).toBeGreaterThanOrEqual(Math.floor(around) - 10);
            return;
          }
          const bar = target.window ?? { oldest: Infinity, youngest: 0 };
          expect(target.ma).toBeLessThanOrEqual(bar.oldest + 1e-9);
          expect(target.ma).toBeGreaterThanOrEqual(bar.youngest - 1e-9);
        },
      ),
    );
  });

  it('Given the narrowest window or all of Earth, Then + or − has no room', () => {
    expect(zoomRoom({ first: 1990, last: 2000 }, PRESENT)).toEqual({ in: false, out: true });
    expect(zoomRoom(presetWindow('eons', PRESENT), PRESENT)).toEqual({ in: true, out: false });
    expect(zoomRoom(TRACK, PRESENT)).toEqual({ in: true, out: true });
  });
});
