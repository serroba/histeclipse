import { describe, expect, it, vi } from 'vitest';

import type { PaleoTempIndex } from '../../data/paleoTemp';
import type { TemperatureSurface } from '../../globe/scene';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import {
  createTemperatureLayer,
  framesToFetch,
  type TemperatureLayerContext,
} from './temperatureLayer';
import {
  TEMPERATURE_MODEL_FOLDERS,
  TEMPERATURE_MODELS,
  type TemperatureModel,
} from '../../deepTime/temperatureModels';

function index(
  frames: readonly [number, number][],
  coverage: 'global' | 'land' = 'global',
): PaleoTempIndex {
  return {
    schemaVersion: 1,
    credit: 'test',
    source: 'https://example.org/',
    coverage,
    columns: 361,
    rows: 181,
    coldest: -60,
    warmest: 40,
    frames: frames.map(([ma, mean]) => ({
      ma,
      file: `${String(Math.round(ma * 1000))}.png`,
      mean,
    })),
  };
}

const krapp = index(
  [
    [0, 13],
    [0.002, 12],
    [0.8, 9],
  ],
  'land',
);
const INDEXES: Readonly<Record<TemperatureModel, PaleoTempIndex>> = {
  // A note on the map 2,000 years ago, as the pipeline might give one.
  krapp: { ...krapp, frames: krapp.frames.map((f, i) => (i === 1 ? { ...f, note: 'Cold.' } : f)) },
  scotese: index([
    [0, 14.6],
    [5, 16],
    [540, 20],
  ]),
  cesm: index([
    [0, 13.2],
    [250, 25],
  ]),
};

/** A layer over fake maps: what the globe was asked, and what failed to load. */
function setUp(failing: readonly string[] = []) {
  const surfaces: (TemperatureSurface | null)[] = [];
  const prefetched: string[][] = [];
  const notices: string[] = [];
  const arrived = vi.fn();
  const context: TemperatureLayerContext = {
    dataUrl: (path) => `/data/${path}`,
    fetchJson: (url) => {
      const folder = url.split('/')[2];
      const model = TEMPERATURE_MODELS.find((each) => TEMPERATURE_MODEL_FOLDERS[each] === folder);
      if (model === undefined || failing.includes(model)) return Promise.reject(new Error('gone'));
      const found = INDEXES[model];
      return Promise.resolve(new Response(JSON.stringify(found)));
    },
    globe: {
      setTemperature: (surface) => surfaces.push(surface),
      prefetch: (urls) => prefetched.push([...urls]),
    },
    notify: (message) => notices.push(message),
    arrived,
  };
  return { layer: createTemperatureLayer(context), surfaces, prefetched, notices, arrived };
}

const off: ViewState = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'temperature', true) };
const deep = { ma: 0.021, ice: false, uncharted: false };
const ice = { ...deep, ice: true };

/** Ask once so every model's maps start loading, and let them arrive. */
async function loaded(failing: readonly string[] = []) {
  const set = setUp(failing);
  set.layer.view(on, deep);
  await vi.waitFor(() => {
    expect(set.arrived).toHaveBeenCalledTimes(3 - failing.length);
  });
  return set;
}

describe('the temperature layer', () => {
  it('says nothing, and loads nothing, while it is off', () => {
    const { layer, surfaces } = setUp();
    expect(layer.view(off, deep)).toMatchObject({ on: false, shown: null, readings: [] });
    expect(layer.drawn(off, deep)).toBe(false);
    layer.show(off, deep, null);
    expect(surfaces).toEqual([null]);
  });

  it('colours the ice ages with Krapp’s maps, by the change from today', async () => {
    const { layer, surfaces } = await loaded();
    const view = layer.view(on, deep);
    expect(view).toMatchObject({ shown: 'krapp', wanted: 'krapp', changing: true });
    expect(view.readings.map((each) => [each.model, each.coverage])).toEqual([
      ['krapp', 'land'],
      ['scotese', 'global'],
      ['cesm', 'global'],
    ]);
    layer.show(on, deep, null);
    expect(surfaces.at(-1)).toMatchObject({
      younger: '/data/krapp/2.png',
      older: '/data/krapp/800.png',
      change: true,
      coldest: -60,
      warmest: 40,
    });
  });

  it('colours by the temperature itself when asked, and never by change on another model', async () => {
    const { layer, surfaces } = await loaded();
    layer.show({ ...on, temperatureShow: 'actual' }, deep, null);
    expect(surfaces.at(-1)?.change).toBe(false);
    const scotese = { ...on, temperatureModel: 'scotese' } as const;
    expect(layer.view(scotese, deep)).toMatchObject({ shown: 'scotese', changing: false });
    layer.show(scotese, deep, null);
    expect(surfaces.at(-1)).toMatchObject({ younger: '/data/paleotemp/0.png', change: false });
  });

  it('stands Scotese in beyond the ice ages; on the ice-age scale, none', async () => {
    const { layer, surfaces } = await loaded();
    const older = { ...deep, ma: 100 };
    expect(layer.view(on, older)).toMatchObject({ wanted: 'krapp', shown: 'scotese' });
    expect(layer.drawn(on, { ...ice, ma: 2 })).toBe(false);
    layer.show(on, { ...ice, ma: 2 }, null);
    expect(surfaces.at(-1)).toBeNull();
    // On the ice-age scale even Scotese asked for gives way to the ice ages' maps.
    const scotese = { ...on, temperatureModel: 'scotese' } as const;
    expect(layer.view(scotese, ice)).toMatchObject({ shown: 'krapp' });
    expect(layer.drawn(on, { ...deep, uncharted: true })).toBe(false);
  });

  it('fetches the maps ahead while playing', async () => {
    const { layer, prefetched } = await loaded();
    layer.show(on, { ...deep, ma: 0.8 }, 0.01);
    expect(prefetched.at(-1)?.[0]).toBe('/data/krapp/2.png');
    expect(framesToFetch(INDEXES.krapp, 0.01)).toBe(20);
    expect(framesToFetch(INDEXES.scotese, 0.01)).toBe(4);
    expect(framesToFetch({ ...INDEXES.cesm, frames: [] }, 1)).toBe(4);
  });

  it('gives the note of the map nearer the moment', async () => {
    const { layer } = await loaded();
    expect(layer.view(on, { ...deep, ma: 0.0021 }).note).toBe('Cold.');
    expect(layer.view(on, { ...deep, ma: 0.5 }).note).toBeNull();
  });

  it('says when a model’s maps cannot be had, and asks again later', async () => {
    const { layer, notices } = await loaded(['cesm']);
    expect(notices).toEqual(['Could not load the CESM, Li et al. 2023 temperature maps: gone']);
    expect(layer.view(on, deep).readings.map((each) => each.model)).toEqual(['krapp', 'scotese']);
  });

  it('draws nothing while no map has arrived', () => {
    const { layer, surfaces } = setUp();
    expect(layer.view(on, deep)).toMatchObject({ on: true, shown: null, readings: [] });
    layer.show(on, deep, null);
    expect(surfaces).toEqual([null]);
  });
});
