import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { Capability, FeatureContext } from '../feature';
import { airFeature, createPlateMasks, platesFeature } from '.';

const base = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const deep = (
  layer: 'plates' | 'air',
  ma: number,
  deepScale: ViewState['deepScale'],
): ViewState => ({
  ...base,
  layers: withLayer(base.layers, layer, true),
  ma,
  deepScale,
});
const moment = (state: ViewState) => ({ ma: state.ma ?? 0, scale: state.deepScale });

/** A context that serves the site's own files and records what the features ask of the app. */
function fakeContext(options: { readonly failing?: boolean } = {}) {
  const refresh = vi.fn();
  const notify = vi.fn();
  const setPlates = vi.fn();
  const boundaries = vi.fn();
  const archive = { loaded: vi.fn((): unknown => null) };
  const fetchJson = vi.fn(async (url: string) => {
    if (options.failing === true) throw new Error('offline');
    return new Response(await readFile(`public${url}`, 'utf8'));
  });
  const context = {
    base: '/',
    fetchJson,
    notify,
    refresh,
    plateOutlines: { setPlates },
    globe: { addLayer: () => ({ update: boundaries }) },
    plateMasks: createPlateMasks('/', fetchJson),
    co2Archive: archive,
  } as unknown as FeatureContext<Capability>;
  return { context, refresh, notify, fetchJson, setPlates, boundaries, archive };
}

describe('the plates as a feature', () => {
  const jurassic = deep('plates', 150, 'all');

  it('asks for the outlines on the globe and their index, with its chip before the others', () => {
    expect(platesFeature.needs).toEqual(['plateOutlines', 'plateMasks']);
    expect(platesFeature.deepChip).toMatchObject({ label: 'Plates', why: 'plates' });
    expect(platesFeature.deepChipOrder).toBe(-1);
    expect(platesFeature.watches(jurassic)).toEqual([jurassic.layers, 150, 'all']);
  });

  it('offers its chip, off, and outlines nothing while its layer is off or deep time is left', () => {
    const { context, setPlates, fetchJson } = fakeContext();
    const shown = platesFeature.mount(context, context);
    const off = { ...base, ma: 150 };
    expect(shown.deep?.(off, moment(off))).toEqual({ offered: true, on: false, note: null });
    expect(shown.deep?.(jurassic, null)).toBeNull();
    expect(setPlates).toHaveBeenCalledTimes(2);
    expect(setPlates).toHaveBeenLastCalledWith(null);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('says the outlines are loading, once, then outlines the continents of the moment', async () => {
    const { context, refresh, setPlates, fetchJson } = fakeContext();
    const shown = platesFeature.mount(context, context);
    const loading = shown.deep?.(jurassic, moment(jurassic));
    shown.deep?.(jurassic, moment(jurassic));
    expect(JSON.stringify(loading?.note)).toContain('Loading the continent outlines…');
    expect(fetchJson).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    const chip = shown.deep?.(jurassic, moment(jurassic));
    expect(chip).toMatchObject({ offered: true, on: true });
    expect(JSON.stringify(chip?.note)).not.toContain('Loading');
    expect(setPlates).toHaveBeenLastCalledWith(
      expect.objectContaining({ younger: expect.stringMatching(/^\/data\/plates\//) as string }),
    );
  });

  it('draws where its plates met at the moment, turned as its continents are (#1160)', async () => {
    const { context, refresh, boundaries } = fakeContext();
    const shown = platesFeature.mount(context, context);
    const silurian = deep('plates', 440, 'all');
    shown.deep?.(silurian, moment(silurian));
    // The masks' index, then the boundaries' index, then the frame of 440 Ma.
    for (const times of [1, 2, 3]) {
      await vi.waitFor(() => {
        expect(refresh).toHaveBeenCalledTimes(times);
      });
      shown.deep?.(silurian, moment(silurian));
    }
    expect(boundaries).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: expect.stringMatching(/^440:\d/) as string }),
    );
    const off = { ...silurian, layers: new Set<never>() };
    shown.deep?.(off, moment(off));
    expect(boundaries).toHaveBeenLastCalledWith(null);
  });

  it('outlines nothing beyond the plates’ reach, and says how far they reach', async () => {
    const { context, refresh, setPlates } = fakeContext();
    const shown = platesFeature.mount(context, context);
    const early = deep('plates', 4000, 'eons');
    shown.deep?.(early, moment(early));
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    const chip = shown.deep?.(early, moment(early));
    expect(setPlates).toHaveBeenLastCalledWith(null);
    expect(chip?.on).toBe(true);
    expect(JSON.stringify(chip?.note)).toMatch(/\d/);
  });

  it('says how far the plates have moved, on the ice ages’ span only, once its file is in', async () => {
    const { context, refresh, fetchJson } = fakeContext();
    const shown = platesFeature.mount(context, context);
    expect(shown.deepBar?.(jurassic, moment(jurassic))).toEqual({ plateMotion: null });
    expect(fetchJson).not.toHaveBeenCalled();
    const ice = deep('plates', 1, 'ice');
    expect(shown.deepBar?.(ice, moment(ice))).toEqual({ plateMotion: null });
    shown.deepBar?.(ice, moment(ice));
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchJson).toHaveBeenCalledWith('/data/plates-motion.json');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(shown.deepBar?.(ice, moment(ice)).plateMotion).toMatch(/\S/);
  });

  it('tells the reader when a file does not load, and asks again the next time', async () => {
    const { context, notify, fetchJson } = fakeContext({ failing: true });
    const shown = platesFeature.mount(context, context);
    const ice = deep('plates', 1, 'ice');
    shown.deep?.(ice, moment(ice));
    shown.deepBar?.(ice, moment(ice));
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the continent outlines: offline');
      expect(notify).toHaveBeenCalledWith('Could not load how far the plates moved: offline');
    });
    shown.deep?.(ice, moment(ice));
    shown.deepBar?.(ice, moment(ice));
    expect(fetchJson).toHaveBeenCalledTimes(4);
  });
});

describe('the air as a feature', () => {
  const ice = deep('air', 0.1, 'ice');
  const all = deep('air', 100, 'all');

  it('asks for the archive, and watches the layers, the moment and the span', () => {
    expect(airFeature.needs).toEqual(['co2Archive']);
    expect(airFeature.watches(ice)).toEqual([ice.layers, 0.1, 'ice']);
  });

  it('is off, loading nothing, while its layer is off or on the eons’ span', () => {
    const { context, fetchJson } = fakeContext();
    const shown = airFeature.mount(context, context);
    const off = { ...base, ma: 1 };
    expect(shown.deepBar?.(off, moment(off))).toEqual({ air: { on: false } });
    const eons = deep('air', 3000, 'eons');
    expect(shown.deepBar?.(eons, moment(eons))).toEqual({ air: { on: false } });
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('loads the ice cores’ gases on the ice ages’ span, once, and shows them', async () => {
    const { context, refresh, fetchJson } = fakeContext();
    const shown = airFeature.mount(context, context);
    expect(shown.deepBar?.(ice, moment(ice))).toEqual({
      air: { on: true, atmosphere: null, deep: null, archive: null },
    });
    shown.deepBar?.(ice, moment(ice));
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchJson).toHaveBeenCalledWith('/data/atmosphere.json');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(shown.deepBar?.(ice, moment(ice)).air).toMatchObject({ on: true, deep: null });
    expect(shown.deepBar?.(ice, moment(ice)).air).not.toMatchObject({ atmosphere: null });
  });

  it('loads the gases of the last 540 million years on that span, and passes the archive on', async () => {
    const { context, refresh, fetchJson, archive } = fakeContext();
    const shown = airFeature.mount(context, context);
    shown.deepBar?.(all, moment(all));
    expect(fetchJson).toHaveBeenCalledWith('/data/air-deep.json');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    archive.loaded.mockReturnValue('the archive');
    expect(shown.deepBar?.(all, moment(all)).air).toMatchObject({
      on: true,
      atmosphere: null,
      archive: 'the archive',
    });
    expect(shown.deepBar?.(all, moment(all)).air).not.toMatchObject({ deep: null });
  });

  it('tells the reader when the gases do not load, and asks again the next time', async () => {
    const { context, notify, fetchJson } = fakeContext({ failing: true });
    const shown = airFeature.mount(context, context);
    shown.deepBar?.(ice, moment(ice));
    shown.deepBar?.(all, moment(all));
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the ice-core gases: offline');
      expect(notify).toHaveBeenCalledWith('Could not load the deep-time gases: offline');
    });
    shown.deepBar?.(ice, moment(ice));
    expect(fetchJson).toHaveBeenCalledTimes(3);
  });
});
