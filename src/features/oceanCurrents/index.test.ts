// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import type { LayerFactory, LayerHost } from '../../globe/layerHost';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { Capability, FeatureContext } from '../feature';
import { oceanCurrentsFeature } from '.';

vi.mock('../../util/loadImage', () => ({
  loadImage: (url: string) => Promise.resolve({ width: 361, height: 181, url }),
}));
vi.mock('./flowLayer', () => ({
  flowLayer: () => ({ update: (field: unknown) => drawn.push(field) }),
}));
const drawn: unknown[] = [];

const INDEX = {
  schemaVersion: 1,
  credit: 'c',
  source: 'https://example.org/',
  paper: 'https://example.org/p',
  licence: 'l',
  accessed: '2026-11-20',
  units: 'm/s',
  encoding: 'e',
  files: 'f',
  first: '1940-01',
  last: '2021-12',
  equator: 3,
  columns: 361,
  rows: 181,
  depths: [
    { id: 'surface', metres: 1, bound: 1 },
    { id: '1500m', metres: 1500, bound: 0.2 },
  ],
};

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'oceanCurrents', true) };
const inYear = (year: number, state = on): ViewState => ({
  ...state,
  time: moveToYear(state.time, astronomicalYear(year)),
});
const JD = 2451545;

function fakeContext(options: { readonly failing?: boolean } = {}) {
  const container = document.createElement('div');
  const refresh = vi.fn();
  const notify = vi.fn();
  const context = {
    base: '/',
    fetchJson: () =>
      options.failing === true
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify(INDEX))),
    globe: {
      addLayer: (factory: LayerFactory<unknown>) => factory({ container } as unknown as LayerHost),
    },
    notify,
    refresh,
  } as unknown as FeatureContext<Capability>;
  return { context, container, refresh, notify };
}

describe('Ocean currents as a feature (#927)', () => {
  it('Given it on, Then it loads, says the month near the surface, and a depth picked changes it', async () => {
    const { context, container, refresh } = fakeContext();
    const shown = oceanCurrentsFeature.mount(context, context);
    shown.show?.(inYear(1998), JD);
    expect(shown.said?.()).toBe('Loading the ocean currents…');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    shown.show?.(inYear(1998), JD);
    expect(shown.said?.()).toMatch(/^The currents near the surface, January 1998/);
    const picker = container.querySelector<HTMLSelectElement>('.ocean-currents-pick');
    expect(picker?.options).toHaveLength(2);
    if (picker === null) return;
    picker.value = '1500m';
    picker.dispatchEvent(new Event('change'));
    shown.show?.(inYear(1998), JD);
    expect(shown.said?.()).toMatch(/^The currents at 1,500 m, January 1998/);
    shown.show?.({ ...on, ma: 1 }, JD);
    expect(shown.said?.()).toBeNull();
    expect(drawn.at(-1)).toBeNull();
    expect(container.querySelector<HTMLElement>('.ocean-currents-panel')?.hidden).toBe(true);
  });

  it('Given the index does not load, Then it says so', async () => {
    const { context, notify } = fakeContext({ failing: true });
    const shown = oceanCurrentsFeature.mount(context, context);
    shown.show?.(inYear(1998), JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the ocean currents: offline');
    });
  });
});
