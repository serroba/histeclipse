import { describe, expect, it } from 'vitest';

import { createStore } from '../../state/store';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import { yearPlayhead } from '../../time/yearPlay';
import { travelBrings, windowing } from './windowing';

const WHOLE = { first: -9699, last: 2026 };
const start = (year: number): ViewState => {
  const base = defaultViewState(new Date('2026-06-15T12:00:00Z'));
  return { ...base, time: moveToYear(base.time, astronomicalYear(year)) };
};
const settle = (): Promise<void> =>
  new Promise((done) => {
    queueMicrotask(done);
  });

describe('the Years bar’s window (#749)', () => {
  it('Given no window, or one past the track, Then the whole track or the window held to it', () => {
    const store = createStore(start(2026));
    const bar = windowing(store, () => WHOLE);
    expect(bar.shown(store.get())).toEqual(WHOLE);
    expect(bar.shown({ ...store.get(), yearsWindow: { first: 1854, last: 2026 } })).toEqual({
      first: 1854,
      last: 2026,
    });
    expect(bar.shown({ ...store.get(), yearsWindow: { first: -20000, last: 3000 } })).toEqual(
      WHOLE,
    );
  });

  it('Given a window picked, Then kept, the year moved into it if outside; the whole track is none', () => {
    const store = createStore(start(1500));
    const bar = windowing(store, () => WHOLE);
    bar.set({ first: 1854, last: 2026 });
    expect(store.get().yearsWindow).toEqual({ first: 1854, last: 2026 });
    expect(store.get().time.date.year).toBe(2026);
    bar.set({ first: 1900, last: 2026 });
    expect(store.get().time.date.year).toBe(2026);
    bar.set(null);
    expect(store.get().yearsWindow).toBeNull();
  });

  it('Given a layer with a span turned on, Then the bar fits it and the year shown, never moving it', async () => {
    const store = createStore(start(1500));
    const bar = windowing(store, () => WHOLE);
    bar.fitNew(store.get(), false); // a link's first showing: nothing fitted
    await settle();
    expect(store.get().yearsWindow).toBeNull();
    const on = { ...store.get(), layers: withLayer(store.get().layers, 'enso', true) };
    store.set(on);
    bar.fitNew(on, false);
    await settle();
    expect(store.get().yearsWindow).toEqual({ first: 1500, last: 2026 });
    expect(store.get().time.date.year).toBe(1500);
  });

  it('Given layers turned on while playing, in deep time, or without spans, Then no fit', async () => {
    const store = createStore(start(2000));
    const bar = windowing(store, () => WHOLE);
    bar.fitNew(store.get(), false);
    const add = (state: ViewState, layer: 'enso' | 'rocks' | 'warming'): ViewState => ({
      ...state,
      layers: withLayer(state.layers, layer, true),
    });
    bar.fitNew(add(store.get(), 'enso'), true);
    bar.fitNew({ ...add(store.get(), 'warming'), ma: 1 }, false);
    bar.fitNew(add(store.get(), 'rocks'), false);
    await settle();
    expect(store.get().yearsWindow).toBeNull();
  });

  it('Given the layers on, Then the windows offered and the one shown', () => {
    const store = createStore<ViewState>({
      ...start(2000),
      yearsWindow: { first: 1854, last: 2026 },
      layers: new Set(['enso'] as const),
    });
    const { windows, window } = windowing(store, () => WHOLE).choices(store.get());
    expect(window).toBe('1854,2026');
    expect(windows.at(-1)).toEqual({ value: '1854,2026', label: 'El Niño and La Niña, 1854–2026' });
  });

  it('Given a window, Then its speeds by level, and where playing starts', () => {
    const store = createStore<ViewState>({
      ...start(2026),
      yearsWindow: { first: 1854, last: 2026 },
    });
    const bar = windowing(
      store,
      () => WHOLE,
      () => 6,
    );
    const { speeds, speed } = bar.speeds(store.get(), 'fast');
    expect(speeds.map(({ label }) => label)).toEqual(['2 months/s', '1 yr/s', '10 yr/s']);
    expect(speed.label).toBe('10 yr/s');
    // None picked: El Niño's years start slow (#984).
    expect(bar.speeds(store.get(), null).speed.label).toBe('2 months/s');
    // In June 2026, today's month: the end, so it starts again from January 1854.
    expect(bar.start(store.get())?.date).toMatchObject({ year: 1854, month: 1 });
    expect(bar.start({ ...store.get(), time: start(1900).time })).toBeNull();
    expect(bar.start({ ...store.get(), time: start(1500).time })?.date.year).toBe(1854);
  });

  it('Given a slow speed under a year a second, Then month by month, stopping at today’s month', () => {
    const narrow = { first: 2016, last: 2026 };
    const bar = windowing(
      createStore(start(2026)),
      () => WHOLE,
      () => 6,
    );
    const head = yearPlayhead();
    const may = (year: number, month: number): ViewState => {
      const base = start(year);
      return {
        ...base,
        yearsWindow: narrow,
        time: { ...base.time, date: { ...base.time.date, month } },
      };
    };
    // Ten years: slow is a month a second; a second moves a month on.
    const next = bar.step(may(2020, 5), 'slow', 0.25, head);
    expect(next).toEqual({ time: null, done: false });
    const later = bar.step(may(2020, 5), 'slow', 0.25, head);
    expect(later.time).toBeNull();
    bar.step(may(2020, 5), 'slow', 0.25, head);
    const moved = bar.step(may(2020, 5), 'slow', 0.25, head);
    expect(moved.time?.date).toMatchObject({ year: 2020, month: 6 });
    const end = bar.step(may(2026, 5), 'slow', 0.25, yearPlayhead());
    expect(end.done).toBe(false);
    const last = bar.step(may(2026, 6), 'slow', 0.25, yearPlayhead());
    expect(last).toEqual({ time: null, done: true });
    // Before year 0, months still count up: December 2 BCE (year -1) then January 1 BCE.
    const bce = windowing(createStore(start(0)), () => WHOLE).step(
      { ...may(-1, 12), yearsWindow: { first: -9, last: 1 } },
      'slow',
      0.25,
      (() => {
        const ahead = yearPlayhead();
        ahead.step(-1 * 12 + 11, 1, 0.25, 100);
        ahead.step(-1 * 12 + 11, 1, 0.25, 100);
        ahead.step(-1 * 12 + 11, 1, 0.25, 100);
        return ahead;
      })(),
    );
    expect(bce.time?.date).toMatchObject({ year: 0, month: 1 });
  });

  it('Given a speed of years a second, Then year by year, stopping at the window’s end', () => {
    const bar = windowing(
      createStore(start(2000)),
      () => WHOLE,
      () => 6,
    );
    const state = { ...start(1000), yearsWindow: { first: 1000, last: 1100 } };
    // A hundred years fast: 5 yr/s, so a quarter-second moves a year on.
    const moved = bar.step(state, 'fast', 0.25, yearPlayhead());
    expect(moved.time?.date.year).toBe(1001);
    expect(moved.done).toBe(false);
    const end = bar.step({ ...state, time: start(1099).time }, 'fast', 0.25, yearPlayhead());
    expect(end).toMatchObject({ done: true });
    expect(end.time?.date.year).toBe(1100);
  });

  it('Given a layer with years of its own on, Then playing brings no borders or ways of life', () => {
    expect(travelBrings(new Set())).toEqual(['empires', 'ways']);
    expect(travelBrings(new Set(['empires'] as const))).toEqual(['ways']);
    expect(travelBrings(new Set(['enso'] as const))).toEqual([]);
    expect(travelBrings(new Set(['rocks', 'warming'] as const))).toEqual([]);
  });
});

describe('sliding the Years bar’s window (#749)', () => {
  it('Given a window, When slid, Then it moves along the track, its width kept, the year kept', () => {
    const store = createStore<ViewState>({
      ...start(1500),
      yearsWindow: { first: 1400, last: 1600 },
    });
    const bar = windowing(store, () => WHOLE);
    bar.pan(0.25);
    expect(store.get().yearsWindow).toEqual({ first: 1450, last: 1650 });
    expect(store.get().time.date.year).toBe(1500);
    // Past the track's end it stops there.
    bar.pan(10);
    expect(store.get().yearsWindow).toEqual({ first: 1826, last: 2026 });
  });

  it('Given a window slid past the year, Then the year is carried at the nearer end', () => {
    const store = createStore<ViewState>({
      ...start(1450),
      yearsWindow: { first: 1400, last: 1600 },
    });
    const bar = windowing(store, () => WHOLE);
    bar.pan(0.5);
    expect(store.get().yearsWindow).toEqual({ first: 1500, last: 1700 });
    expect(store.get().time.date.year).toBe(1500);
  });

  it('Given nudges too small to move a decade a whole year, Then they add up until it moves', () => {
    const store = createStore<ViewState>({
      ...start(1505),
      yearsWindow: { first: 1500, last: 1510 },
    });
    const bar = windowing(store, () => WHOLE);
    bar.pan(0.03);
    expect(store.get().yearsWindow).toEqual({ first: 1500, last: 1510 });
    bar.pan(0.03);
    expect(store.get().yearsWindow).toEqual({ first: 1501, last: 1511 });
  });
});
