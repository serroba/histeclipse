import { describe, expect, it, vi } from 'vitest';

import file from '../../../public/data/enso/index.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { FeatureContext } from '../feature';
import { ensoFeature } from '.';

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'enso', true) };
const inYear = (year: number, state = on): ViewState => ({
  ...state,
  time: moveToYear(state.time, astronomicalYear(year)),
});
const JD = 2451545;

function fakeContext(options: { readonly failing?: boolean } = {}) {
  const panels: unknown[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  const context = {
    base: '/',
    fetchJson: () =>
      options.failing === true
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify(file))),
    globe: { addLayer: () => ({ update: (input: unknown) => panels.push(input) }) },
    notify,
    refresh,
  } as unknown as FeatureContext;
  return { context, panels, refresh, notify };
}

describe('El Niño and La Niña as a feature', () => {
  it('Given the layer off, Then no panel and nothing said', () => {
    const { context, panels } = fakeContext();
    const shown = ensoFeature.mount(context);
    shown.show?.(inYear(1998, off), JD);
    expect(panels).toEqual([null]);
    expect(shown.said?.()).toBeNull();
  });

  it('Given it on, Then it loads once and shows each month, the same month costing nothing, and rests in deep time', async () => {
    const { context, panels, refresh } = fakeContext();
    const shown = ensoFeature.mount(context);
    shown.show?.(inYear(1998), JD);
    expect(shown.said?.()).toBe('Loading the El Niño indices…');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    shown.show?.(inYear(1998), JD);
    expect(panels.at(-1)).toMatchObject({
      names: [
        { id: 'roni', name: 'Relative Oceanic Niño Index (RONI)' },
        { id: 'oni', name: 'Oceanic Niño Index (ONI)' },
      ],
    });
    expect(shown.said?.()).toMatch(/^January 1998: El Niño by both indices/);
    const count = panels.length;
    shown.show?.(inYear(1998), JD);
    expect(panels).toHaveLength(count);
    shown.show?.({ ...on, ma: 1 }, JD);
    expect(panels.at(-1)).toBeNull();
  });

  it('Given the indices do not load, Then it says so and tries again', async () => {
    const { context, notify } = fakeContext({ failing: true });
    const shown = ensoFeature.mount(context);
    shown.show?.(inYear(1998), JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the El Niño indices: offline');
    });
    shown.show?.(inYear(1998), JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(2);
    });
  });
});
