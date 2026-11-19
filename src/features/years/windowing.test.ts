import { describe, expect, it } from 'vitest';

import { createStore } from '../../state/store';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import { windowing } from './windowing';

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
});
