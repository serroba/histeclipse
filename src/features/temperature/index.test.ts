import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { Capability, FeatureContext } from '../feature';
import { temperatureFeature } from '.';

const base = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const off: ViewState = { ...base, ma: 100, deepScale: 'all' };
const on: ViewState = { ...off, layers: withLayer(off.layers, 'temperature', true) };
const cretaceous = { ma: 100, scale: 'all' } as const;

/** A context that serves the site's own files and records what the feature asks of the app. */
function fakeContext() {
  const notify = vi.fn();
  const again = vi.fn();
  const setTemperature = vi.fn();
  const prefetch = vi.fn();
  const fetchJson = vi.fn(
    async (url: string) => new Response(await readFile(`public${url}`, 'utf8')),
  );
  const context = {
    base: '/',
    fetchJson,
    notify,
    temperatureMaps: { setTemperature, prefetch },
    deepTime: { again },
  } as unknown as FeatureContext<Capability>;
  return { context, notify, again, setTemperature, prefetch, fetchJson };
}

describe('the temperature maps as a feature', () => {
  it('asks for the maps on the globe and deep time, and watches the layers, the moment and the choices', () => {
    expect(temperatureFeature.needs).toEqual(['temperatureMaps', 'deepTime']);
    expect(temperatureFeature.watches(on)).toEqual([
      on.layers,
      100,
      'all',
      on.temperatureModel,
      on.temperatureShow,
    ]);
  });

  it('says it is off, and colours nothing, while its layer is off', () => {
    const { context, fetchJson } = fakeContext();
    const shown = temperatureFeature.mount(context, context);
    expect(shown.deepBar?.(off, cretaceous)).toMatchObject({
      temperature: { on: false },
      temperatureDrawn: false,
    });
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('loads its maps with the layer on, asks deep time to draw again, then colours the globe', async () => {
    const { context, again, setTemperature, notify } = fakeContext();
    const shown = temperatureFeature.mount(context, context);
    expect(shown.deepBar?.(on, cretaceous)).toMatchObject({
      temperature: { on: true, shown: null },
      temperatureDrawn: false,
    });
    await vi.waitFor(() => {
      expect(again).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(shown.deepBar?.(on, cretaceous)).toMatchObject({
        temperature: { on: true },
        temperatureDrawn: true,
      });
    });
    expect(setTemperature).toHaveBeenLastCalledWith(expect.objectContaining({}));
    expect(notify).not.toHaveBeenCalled();
  });

  it('fetches the maps ahead while deep time plays towards the present', async () => {
    const { context, again, prefetch } = fakeContext();
    const shown = temperatureFeature.mount(context, context);
    shown.deepBar?.(on, cretaceous);
    await vi.waitFor(() => {
      expect(again).toHaveBeenCalled();
      expect(shown.deepBar?.(on, cretaceous).temperatureDrawn).toBe(true);
    });
    shown.deepBar?.(on, { ...cretaceous, uncharted: false, maPerSecond: 5 });
    expect(prefetch).toHaveBeenCalled();
  });
});
