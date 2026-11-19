// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import composites from '../../../public/data/enso-composites/index.json';
import early from '../../../public/data/enso/early.json';
import file from '../../../public/data/enso/index.json';
import ersstMaps from '../../../public/data/enso-ersst/index.json';
import type { LayerFactory, LayerHost } from '../../globe/layerHost';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { Capability, FeatureContext } from '../feature';
import { ensoMapLayer } from './ensoMapLayer';
import { ensoFeature } from '.';

vi.mock('../../util/loadImage', () => ({
  loadImage: (url: string) => Promise.resolve({ width: 361, height: 181, url }),
}));
vi.mock('./pixels', () => ({ pixelsOf: () => new Uint8ClampedArray(361 * 181 * 4).fill(255) }));

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
  const container = document.createElement('div');
  const panels: unknown[] = [];
  const painted: unknown[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  const context = {
    base: '/',
    fetchJson: (url: string) =>
      options.failing === true
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(
            new Response(
              JSON.stringify(
                url.includes('enso-sst')
                  ? MAPS
                  : url.includes('enso-ersst')
                    ? ersstMaps
                    : url.includes('enso-composites')
                      ? composites
                      : url.includes('early')
                        ? early
                        : file,
              ),
            ),
          ),
    globe: {
      addLayer: (factory: LayerFactory<unknown>) => {
        if (factory === (ensoMapLayer as LayerFactory<unknown>)) {
          return { update: (input: unknown) => painted.push(input) };
        }
        const layer = factory({ container } as unknown as LayerHost);
        return {
          update: (input: unknown) => {
            panels.push(input);
            layer.update(input);
          },
        };
      },
    },
    notify,
    refresh,
  } as unknown as FeatureContext<Capability>;
  return { context, container, panels, painted, refresh, notify };
}

describe('El Niño and La Niña as a feature', () => {
  it('Given the layer off, Then no panel and nothing said', () => {
    const { context, panels } = fakeContext();
    const shown = ensoFeature.mount(context, context);
    shown.show?.(inYear(1998, off), JD);
    expect(panels).toEqual([null]);
    expect(shown.said?.()).toBeNull();
  });

  it('Given it on, Then it loads once and shows each month, the same month costing nothing, and rests in deep time', async () => {
    const { context, panels, painted, refresh } = fakeContext();
    const shown = ensoFeature.mount(context, context);
    shown.show?.(inYear(1998), JD);
    expect(shown.said?.()).toBe('Loading the El Niño indices…');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(3);
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
    const shown = ensoFeature.mount(context, context);
    shown.show?.(inYear(1998), JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the El Niño indices: offline');
    });
    shown.show?.(inYear(1998), JD);
    const said = (): number =>
      notify.mock.calls.filter(
        ([message]) => message === 'Could not load the El Niño indices: offline',
      ).length;
    await vi.waitFor(() => {
      expect(said()).toBe(2);
    });
    expect(notify).toHaveBeenCalledWith(
      'Could not load the El Niño rain and temperature maps: offline',
    );
  });

  it('Given a composite picked, Then it paints instead of the sea, by the index picked, and the sea comes back', async () => {
    const { context, container, panels, painted, refresh } = fakeContext();
    const shown = ensoFeature.mount(context, context);
    shown.show?.(inYear(1998), JD);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(3);
    });
    shown.show?.(inYear(1998), JD);
    const chooser = container.querySelector<HTMLSelectElement>('.enso-pick');
    const by = container.querySelector<HTMLSelectElement>('.enso-by');
    expect(chooser?.options).toHaveLength(9);
    if (chooser === null || by === null) return;
    chooser.value = 'temperature-elNino-djf';
    chooser.dispatchEvent(new Event('change'));
    shown.show?.(inYear(1998), JD);
    await vi.waitFor(() => {
      expect(painted.at(-1)).toMatchObject({
        bound: 1,
        image: { url: '/data/enso-composites/temperature-roni-elNino-djf.png' },
      });
    });
    expect(panels.at(-1)).toMatchObject({
      sea: expect.stringMatching(
        /^On the globe: Temperature in El Niño’s December–February, by RONI/,
      ) as unknown,
      map: { chosen: 'temperature-elNino-djf', scale: 'temperature', ends: '−1 · 0 · +1 °C' },
    });
    by.value = 'oni';
    by.dispatchEvent(new Event('change'));
    shown.show?.(inYear(1998), JD);
    await vi.waitFor(() => {
      expect(painted.at(-1)).toMatchObject({
        image: { url: '/data/enso-composites/temperature-oni-elNino-djf.png' },
      });
    });
    // Back to the first, already loaded: painted at once.
    by.value = 'roni';
    by.dispatchEvent(new Event('change'));
    shown.show?.(inYear(1999), JD);
    expect(painted.at(-1)).toMatchObject({
      image: { url: '/data/enso-composites/temperature-roni-elNino-djf.png' },
    });
    chooser.value = 'sea';
    chooser.dispatchEvent(new Event('change'));
    shown.show?.(inYear(1999), JD);
    await vi.waitFor(() => {
      expect(painted.at(-1)).toMatchObject({ image: { url: '/data/enso-sst/1999-01.png' } });
    });
  });

  it('Given a place picked with the layer on, Then what it has there for “Why here?”, once loaded (#893)', async () => {
    const { context, refresh } = fakeContext();
    const shown = ensoFeature.mount(context, context);
    const place = { ...inYear(1998), location: { latitude: 0, longitude: -120 } };
    expect(shown.here?.({ ...place, ma: 1 })).toBeNull();
    expect(shown.here?.(inYear(1998))).toBeNull();
    expect(shown.here?.(place)).toBeNull();
    shown.show?.(place, JD);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(3);
    });
    shown.show?.(place, JD);
    await vi.waitFor(() => {
      expect(shown.here?.(place)).toMatchObject({
        title: 'El Niño and La Niña',
        why: 'enso',
        text: expect.stringMatching(
          /^The sea’s surface here in January 1998: \+4\.0 °C/,
        ) as unknown,
      });
    });
  });

  it('Given a month before 1950, Then the indices computed here from ERSST and HadISST, said so, and ERSST’s sea (#894)', async () => {
    const { context, panels, painted, refresh } = fakeContext();
    const shown = ensoFeature.mount(context, context);
    const greatOne = inYear(1877);
    shown.show?.(greatOne, JD);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(3);
    });
    shown.show?.(greatOne, JD);
    expect(panels.at(-1)).toMatchObject({
      names: [
        { id: 'ersst', name: 'Relative Niño 3.4 from ERSST v6 (ours)' },
        { id: 'hadisst', name: 'Relative Niño 3.4 from HadISST (ours)' },
      ],
      sea: expect.stringContaining('(NOAA ERSST v6, on its 2° grid)') as unknown,
    });
    expect(shown.said?.()).toMatch(/^January 1877: .* Before 1950 NOAA publishes no index/);
    await vi.waitFor(() => {
      expect(painted.at(-1)).toMatchObject({ image: { url: '/data/enso-ersst/1877-01.png' } });
    });
  });
});
