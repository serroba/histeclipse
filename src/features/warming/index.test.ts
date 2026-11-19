import { describe, expect, it, vi } from 'vitest';

import ensoFile from '../../../public/data/enso/index.json';
import records from '../../../public/data/temperature-records/index.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { FeatureContext } from '../feature';
import { warmingFeature } from '.';

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'warming', true) };
const inYear = (year: number, state = on): ViewState => ({
  ...state,
  time: moveToYear(state.time, astronomicalYear(year)),
});
const JD = 2451545;

function fakeContext(options: { readonly failing?: 'records' | 'enso' } = {}) {
  const panels: unknown[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  const context = {
    base: '/',
    fetchJson: (url: string) => {
      const which = url.includes('enso') ? 'enso' : 'records';
      return options.failing === which
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify(which === 'enso' ? ensoFile : records)));
    },
    globe: { addLayer: () => ({ update: (input: unknown) => panels.push(input) }) },
    notify,
    refresh,
  } as unknown as FeatureContext;
  return { context, panels, refresh, notify };
}

describe('temperature records as a feature', () => {
  it('Given the layer off, Then no panel and nothing said', () => {
    const { context, panels } = fakeContext();
    const shown = warmingFeature.mount(context);
    shown.show?.(inYear(2020, off), JD);
    expect(panels).toEqual([null]);
    expect(shown.said?.()).toBeNull();
  });

  it('Given it on, Then it loads once and shows each year, the same year costing nothing, and rests in deep time', async () => {
    const { context, panels, refresh } = fakeContext();
    const shown = warmingFeature.mount(context);
    shown.show?.(inYear(2020), JD);
    expect(shown.said?.()).toBe('Loading the temperature records…');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });
    shown.show?.(inYear(2020), JD);
    expect(panels.at(-1)).toMatchObject({
      names: expect.arrayContaining([{ id: 'era5', name: 'ERA5 (Copernicus)' }]) as unknown,
    });
    expect(shown.said?.()).toMatch(/^2020, °C above 1850–1900:.* In 2020: RONI, /);
    expect(panels.at(-1)).toMatchObject({ enso: expect.stringMatching(/^In 2020/) as unknown });
    const count = panels.length;
    shown.show?.(inYear(2020), JD);
    expect(panels).toHaveLength(count);
    shown.show?.({ ...on, ma: 1 }, JD);
    expect(panels.at(-1)).toBeNull();
  });

  it('Given the records do not load, Then it says so and tries again', async () => {
    const { context, notify } = fakeContext({ failing: 'records' });
    const shown = warmingFeature.mount(context);
    shown.show?.(inYear(2020), JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the temperature records: offline');
    });
    shown.show?.(inYear(2020), JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(2);
    });
  });

  it('Given the indices do not load, Then it says so once and shows the records without them', async () => {
    const { context, notify, panels, refresh } = fakeContext({ failing: 'enso' });
    const shown = warmingFeature.mount(context);
    shown.show?.(inYear(1998), JD);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
      expect(notify).toHaveBeenCalledWith('Could not load the El Niño indices: offline');
    });
    shown.show?.(inYear(1998), JD);
    shown.show?.(inYear(1999), JD);
    expect(notify).toHaveBeenCalledOnce();
    expect(panels.at(-1)).toMatchObject({ enso: null, chart: { strips: [] } });
  });
});
