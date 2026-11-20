// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import deepFile from '../../../public/data/ocean-temperature/deep.json';
import file from '../../../public/data/ocean-temperature/index.json';
import type { LayerFactory, LayerHost } from '../../globe/layerHost';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { Capability, FeatureContext } from '../feature';
import { oceanTempFeature } from '.';

vi.mock('../../util/loadImage', () => ({
  loadImage: (url: string) => Promise.resolve({ width: 361, height: 181, url }),
}));

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'oceanTemp', true) };
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
            new Response(JSON.stringify(url.endsWith('deep.json') ? deepFile : file)),
          ),
    globe: {
      addLayer: (factory: LayerFactory<unknown>) => {
        const layer = factory({
          container,
          historyPaint: () => ({ show: () => undefined }),
        } as unknown as LayerHost);
        return {
          update: (input: unknown) => {
            if (input !== null && typeof input === 'object' && 'image' in input)
              painted.push(input);
            else if (input === null && container.querySelector('.ocean-temp-panel') === null) {
              painted.push(null);
            } else panels.push(input);
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

describe('Ocean temperature as a feature (#590)', () => {
  it('Given it on, Then it loads, paints the month at 100 m, and a depth picked paints there', async () => {
    const { context, container, panels, painted, refresh } = fakeContext();
    const shown = oceanTempFeature.mount(context, context);
    shown.show?.(inYear(1998), JD);
    expect(shown.said?.()).toBe('Loading the ocean temperature maps…');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    shown.show?.(inYear(1998), JD);
    expect(shown.said?.()).toMatch(/^At 100 m, January 1998/);
    expect(panels.at(-1)).toMatchObject({ depth: '100m', ends: '−4 · 0 · +4 °C' });
    await vi.waitFor(() => {
      expect(painted.at(-1)).toMatchObject({
        bound: 4,
        image: { url: '/data/ocean-temperature/100m/1998-01.png' },
      });
    });
    const picker = container.querySelector<HTMLSelectElement>('.ocean-temp-pick');
    if (picker === null) return;
    picker.value = '700m';
    picker.dispatchEvent(new Event('change'));
    shown.show?.(inYear(1998), JD);
    await vi.waitFor(() => {
      expect(painted.at(-1)).toMatchObject({
        bound: 1,
        image: { url: '/data/ocean-temperature/700m/1998-01.png' },
      });
    });
    expect(shown.said?.()).toContain('Before the Argo floats');
    expect(panels.at(-1)).toMatchObject({
      depths: expect.arrayContaining([{ id: '4000m', name: '4,000 m, yearly' }]) as unknown,
    });
    picker.value = '4000m';
    picker.dispatchEvent(new Event('change'));
    shown.show?.(inYear(1998), JD);
    await vi.waitFor(() => {
      expect(painted.at(-1)).toMatchObject({
        bound: 0.1,
        image: { url: '/data/ocean-temperature/deep/4000m/1998.png' },
      });
    });
    expect(shown.said?.()).toMatch(/^At 4,000 m, the year 1998/);
    const count = panels.length;
    shown.show?.(inYear(1998), JD);
    expect(panels).toHaveLength(count);
    shown.show?.({ ...on, ma: 1 }, JD);
    expect(shown.said?.()).toBeNull();
    expect(container.querySelector<HTMLElement>('.ocean-temp-panel')?.hidden).toBe(true);
  });

  it('Given the index does not load, Then it says so', async () => {
    const { context, notify } = fakeContext({ failing: true });
    const shown = oceanTempFeature.mount(context, context);
    shown.show?.(inYear(1998), JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the ocean temperature maps: offline');
    });
  });
});
