import { describe, expect, it, vi } from 'vitest';

import file from '../../../public/data/enso/index.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { FeatureContext } from '../feature';
import { ensoMapLayer } from './ensoMapLayer';
import { ensoFeature } from '.';

vi.mock('../../util/loadImage', () => ({
  loadImage: (url: string) => Promise.resolve({ width: 361, height: 181, url }),
}));

const MAPS = {
  schemaVersion: 1,
  credit: 'c',
  source: 'https://example.org/',
  paper: 'https://example.org/paper',
  licence: 'l',
  accessed: '2026-11-19',
  units: '°C',
  baseline: '1991–2020, each calendar month against its own mean',
  bound: 4,
  encoding: 'e',
  files: 'YYYY-MM.png',
  first: '1981-09',
  last: '2026-10',
  columns: 361,
  rows: 181,
};

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'enso', true) };
const inYear = (year: number, state = on): ViewState => ({
  ...state,
  time: moveToYear(state.time, astronomicalYear(year)),
});
const JD = 2451545;

function fakeContext(options: { readonly failing?: boolean } = {}) {
  const panels: unknown[] = [];
  const painted: unknown[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  const context = {
    base: '/',
    fetchJson: (url: string) =>
      options.failing === true
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify(url.includes('enso-sst') ? MAPS : file))),
    globe: {
      addLayer: (factory: unknown) => ({
        update: (input: unknown) => (factory === ensoMapLayer ? painted : panels).push(input),
      }),
    },
    notify,
    refresh,
  } as unknown as FeatureContext;
  return { context, panels, painted, refresh, notify };
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
    const { context, panels, painted, refresh } = fakeContext();
    const shown = ensoFeature.mount(context);
    shown.show?.(inYear(1998), JD);
    expect(shown.said?.()).toBe('Loading the El Niño indices…');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });
    shown.show?.(inYear(1998), JD);
    expect(panels.at(-1)).toMatchObject({
      names: [
        { id: 'roni', name: 'Relative Oceanic Niño Index (RONI)' },
        { id: 'oni', name: 'Oceanic Niño Index (ONI)' },
      ],
    });
    expect(shown.said?.()).toMatch(/^January 1998: El Niño by both indices/);
    expect(panels.at(-1)).toMatchObject({ sea: expect.stringMatching(/^On the globe/) as unknown });
    await vi.waitFor(() => {
      expect(painted.at(-1)).toMatchObject({
        bound: 4,
        image: { url: '/data/enso-sst/1998-01.png' },
      });
    });
    const count = panels.length;
    shown.show?.(inYear(1998), JD);
    expect(panels).toHaveLength(count);
    shown.show?.({ ...on, ma: 1 }, JD);
    expect(panels.at(-1)).toBeNull();
    expect(painted.at(-1)).toBeNull();
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
