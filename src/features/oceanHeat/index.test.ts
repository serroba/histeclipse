import { describe, expect, it, vi } from 'vitest';

import index from '../../../public/data/ocean-heat-map/index.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { FeatureContext } from '../feature';
import { oceanHeatLayer } from './oceanHeatLayer';
import { oceanHeatFeature } from '.';

const loaded = vi.hoisted(() => ({ fail: false, urls: [] as string[] }));
vi.mock('../../util/loadImage', () => ({
  loadImage: (url: string) => {
    loaded.urls.push(url);
    return loaded.fail
      ? Promise.reject(new Error('offline'))
      : Promise.resolve({ width: 361, height: 181 });
  },
}));

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'oceanHeat', true) };
const JD = 2451545;

function fakeContext(options: { readonly failing?: boolean } = {}) {
  const painted: unknown[] = [];
  const panels: unknown[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  const context = {
    base: '/',
    fetchJson: () =>
      options.failing === true
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify(index))),
    globe: {
      addLayer: (factory: unknown) => {
        if (factory === oceanHeatLayer) return { update: (input: unknown) => painted.push(input) };
        return { update: (input: unknown) => panels.push(input) };
      },
    },
    notify,
    refresh,
  } as unknown as FeatureContext;
  return { context, painted, panels, refresh, notify };
}

describe('ocean heat as a feature', () => {
  it('Given it off, Then nothing is loaded or said', () => {
    const { context, painted } = fakeContext();
    const shown = oceanHeatFeature.mount(context);
    shown.show?.(off, JD);
    expect(painted).toEqual([]);
    expect(shown.said?.()).toBeNull();
  });

  it('Given it on, Then the index loads, the first map is painted once its image loads, and it goes in deep time', async () => {
    loaded.urls.length = 0;
    const { context, painted, panels, refresh } = fakeContext();
    const shown = oceanHeatFeature.mount(context);
    shown.show?.(on, JD);
    expect(shown.said?.()).toBe('Loading the ocean heat maps…');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(painted.at(-1)).toMatchObject({ bound: 3 });
    });
    expect(loaded.urls).toEqual(['/data/ocean-heat-map/0-2000m-1960-2025.png']);
    expect(panels.at(-1)).toMatchObject({ shown: '0-2000m-1960-2025' });
    expect(shown.said?.()).toMatch(/^0-2000 m, 1960–2025: on average 0\.65 W\/m² gained/);
    shown.show?.(on, JD);
    shown.show?.({ ...on, ma: 5 }, JD);
    expect(painted.at(-1)).toBeNull();
    expect(panels.at(-1)).toBeNull();
    expect(shown.said?.()).toBeNull();
    shown.show?.(on, JD);
    expect(painted.at(-1)).toMatchObject({ bound: 3 });
  });

  it('Given the index or a map does not load, Then it says so', async () => {
    const failing = fakeContext({ failing: true });
    oceanHeatFeature.mount(failing.context).show?.(on, JD);
    await vi.waitFor(() => {
      expect(failing.notify).toHaveBeenCalledWith('Could not load the ocean heat maps: offline');
    });
    loaded.fail = true;
    const { context, notify } = fakeContext();
    oceanHeatFeature.mount(context).show?.(on, JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the ocean heat map: offline');
    });
    loaded.fail = false;
  });
});
