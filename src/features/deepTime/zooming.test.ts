import { describe, expect, it } from 'vitest';

import { createStore } from '../../state/store';
import { defaultViewState, type ViewState } from '../../state/viewState';
import { barWindow } from '../../ui/deepBarModel';
import { deepZooming } from './zooming';

const PRESENT = 2026;
const SPANS = { ice: 2.6, all: 540, eons: 4568 } as const;

/** Deep time's part, as far as zooming sees it: entering and leaving set `ma`, jumps are kept. */
function setUp(state: Partial<ViewState>) {
  const store = createStore<ViewState>({
    ...defaultViewState(new Date('2026-06-15T12:00:00Z')),
    ...state,
  });
  const jumps: number[] = [];
  const zooming = deepZooming({
    store,
    present: PRESENT,
    mapsReach: () => 540,
    shown: (now) => barWindow(now.deepWindow, SPANS[now.deepScale], now.ma ?? 0),
    enter: (ma) => {
      store.set((now) => ({ ...now, ma, deepWindow: null }));
    },
    leave: () => {
      store.set((now) => ({ ...now, ma: null }));
    },
    jump: (ma) => {
      jumps.push(ma);
      store.set((now) => ({ ...now, ma }));
    },
  });
  return { store, jumps, ...zooming };
}

describe('zooming deep time’s bar (#1074)', () => {
  it('Given part of the Cretaceous, When zoomed out, Then twice the time about the moment, the moment kept', () => {
    const { store, zoom } = setUp({
      ma: 100,
      deepScale: 'all',
      deepWindow: { oldest: 124, youngest: 76 },
    });
    zoom(2);
    expect(store.get()).toMatchObject({
      ma: 100,
      deepScale: 'all',
      deepWindow: { oldest: 148, youngest: 52 },
    });
  });

  it('Given the ice ages at today, When zoomed in far, Then the years come back, ending today', () => {
    const { store, zoom } = setUp({ ma: 0, deepScale: 'ice', deepWindow: null });
    for (let step = 0; step < 20 && store.get().ma !== null; step += 1) zoom(0.5);
    expect(store.get().ma).toBeNull();
    expect(store.get().yearsWindow?.last).toBe(PRESENT);
  });

  it('Given the years, When a zoom lands in deep time, Then it enters at the moment, the years’ window left behind', () => {
    const { store, land } = setUp({ ma: null, yearsWindow: { first: 1854, last: 2026 } });
    land({ model: 'deep', scale: 'ice', window: { oldest: 0.022, youngest: 0 }, ma: 0 });
    expect(store.get()).toMatchObject({
      ma: 0,
      deepScale: 'ice',
      deepWindow: { oldest: 0.022, youngest: 0 },
      yearsWindow: null,
    });
  });

  it('Given out of deep time, Then a zoom does nothing', () => {
    const { store, zoom, fit } = setUp({ ma: null });
    const before = store.get();
    zoom(2);
    fit(143.1, 66);
    expect(store.get()).toBe(before);
  });
});

describe('fitting deep time’s bar to a unit (#1075)', () => {
  it('Given a moment in the Cretaceous, When fitted to it, Then the bar shows it all, the moment kept', () => {
    const { store, jumps, fit } = setUp({ ma: 100, deepScale: 'all', deepWindow: null });
    fit(143.1, 66);
    expect(store.get()).toMatchObject({ ma: 100, deepWindow: { oldest: 143.1, youngest: 66 } });
    expect(jumps).toEqual([]);
  });

  it('Given a moment outside, When fitted to the Jurassic, Then the moment goes to its start', () => {
    const { store, jumps, fit } = setUp({ ma: 100, deepScale: 'all', deepWindow: null });
    fit(201.4, 143.1);
    expect(jumps).toEqual([201.4]);
    expect(store.get()).toMatchObject({
      ma: 201.4,
      deepWindow: { oldest: 201.4, youngest: 143.1 },
    });
  });

  it('Given the ice ages, When fitted to the Holocene, Then deep time shows it (it starts 50 years before the years do); zoomed in, the years', () => {
    const { store, jumps, fit, zoom } = setUp({ ma: 0.021, deepScale: 'ice', deepWindow: null });
    fit(0.0117, 0);
    expect(jumps).toEqual([0.011]);
    expect(store.get()).toMatchObject({
      ma: 0.011,
      deepScale: 'ice',
      deepWindow: { oldest: 0.012, youngest: 0 },
    });
    zoom(0.5);
    expect(store.get().ma).toBeNull();
  });

  it('Given a zoom that lands on the whole track of years, Then no window of years is kept', () => {
    const { store, land } = setUp({ ma: 0.005, yearsWindow: { first: 1854, last: 2026 } });
    land({ model: 'years', window: { first: -9699, last: PRESENT } });
    expect(store.get()).toMatchObject({ ma: null, yearsWindow: null });
    land({ model: 'years', window: { first: 1900, last: PRESENT } });
    expect(store.get().yearsWindow).toEqual({ first: 1900, last: PRESENT });
  });
});

describe('panning deep time’s bar (#749)', () => {
  it('Given part of the Cretaceous, When slid towards today, Then the window moves, its width and the moment kept', () => {
    const { store, pan } = setUp({
      ma: 100,
      deepScale: 'all',
      deepWindow: { oldest: 124, youngest: 76 },
    });
    pan(0.25);
    expect(store.get()).toMatchObject({
      ma: 100,
      deepScale: 'all',
      deepWindow: { oldest: 112, youngest: 64 },
    });
  });

  it('Given a window slid past the moment, Then the moment is carried at its nearer end', () => {
    const { store, pan } = setUp({
      ma: 120,
      deepScale: 'all',
      deepWindow: { oldest: 124, youngest: 76 },
    });
    pan(0.5);
    expect(store.get()).toMatchObject({ ma: 100, deepWindow: { oldest: 100, youngest: 52 } });
  });

  it('Given a nudge too small to move the window, Then nudges add up until it moves', () => {
    const { store, pan } = setUp({
      ma: 0.02,
      deepScale: 'ice',
      deepWindow: { oldest: 0.05, youngest: 0.01 },
    });
    pan(-0.01);
    expect(store.get().deepWindow).toEqual({ oldest: 0.05, youngest: 0.01 });
    pan(-0.01);
    pan(-0.01);
    expect(store.get().deepWindow).toEqual({ oldest: 0.051, youngest: 0.011 });
  });

  it('Given the whole span, When slid towards today, Then nothing moves; outside deep time, nothing', () => {
    const { store, pan } = setUp({ ma: 100, deepScale: 'all', deepWindow: null });
    pan(0.3);
    expect(store.get()).toMatchObject({ ma: 100, deepScale: 'all', deepWindow: null });
    const years = setUp({ ma: null });
    years.pan(0.3);
    expect(years.store.get().ma).toBeNull();
  });
});
