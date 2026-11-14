import { setImmediate } from 'node:timers/promises';
import { describe, expect, it, vi } from 'vitest';

import type { Globe } from '../../globe/globe';
import { defaultViewState, type ViewState } from '../../state/viewState';
import type { Fetch } from '../../util/fetchJson';
import { mountIceAges, type IceAgesContext } from './index';

// Tiny catalogs go through the real runtime validators and domain calculations.
const credit = { schemaVersion: 1, credit: 'Test reconstruction', source: 'https://example.org' };
const grid = { columns: 2, rows: 2 };
const series = (id: string, level: number[]) => ({
  id,
  label: id,
  method: 'test',
  source: 'test',
  url: 'https://example.org',
  licence: 'CC0',
  ages: [0, 20, 40, 100, 200],
  level,
});
const levels = {
  schemaVersion: 1,
  series: [
    series('bintanja-2008', [0, -120, -60, -60, 0]),
    series('spratt-2016', [10, -90, -40, -40, 10]),
  ],
};
const ice = {
  ...credit,
  ...grid,
  metresPerStep: 16,
  frames: [
    { ka: 0, file: '0.png', ice: 0.1 },
    { ka: 20, file: '20000.png', ice: 0.2 },
    { ka: 40, file: '40000.png', ice: 0.15 },
  ],
};
const outlines = {
  ...credit,
  scale: 100,
  slices: [
    { name: 'MIS 6', fromKa: 132, toKa: 190, min: [], best: [[0, 0, 100, 0, 0, 100]], max: [] },
  ],
};
const source = (id: string, era: 'today' | 'lgm') => ({
  id,
  era,
  label: id,
  credit: 'test',
  most: `${id}-most.png`,
  yearRound: `${id}-year.png`,
  extent: 0.1,
});
const seaIce = {
  schemaVersion: 1,
  ...grid,
  stepsPerPercent: 2.5,
  sources: [source('today', 'today'), source('mpi-esm1-2-lr', 'lgm'), source('miroc-es2l', 'lgm')],
};
const catalogs: Record<string, unknown> = {
  'sealevel/index.json': levels,
  'shelf/index.json': { ...credit, ...grid, file: 'shelf.png', lowest: -200, highest: 55 },
  'icesheets/index.json': ice,
  'icesheets/batchelor.json': outlines,
  'seaice/index.json': seaIce,
};
const base = defaultViewState(new Date('2026-03-16T12:00:00Z'));
const deep: ViewState = { ...base, ma: 0.03, deepScale: 'ice', layers: new Set() };

function deferred() {
  let resolve!: (response: Response) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Response>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function harness() {
  const pending = new Map<string, ReturnType<typeof deferred>>();
  const fetchJson = vi.fn<Fetch>((url) => {
    const request = deferred();
    pending.set(url.replace('/assets/data/', ''), request);
    return request.promise;
  });
  // Never invoke a concrete layer factory: record the feature's commands instead.
  const updateOutlines = vi.fn<(input: unknown) => void>();
  const globe = {
    addLayer: vi.fn<Globe['addLayer']>().mockReturnValue({ update: updateOutlines }),
    setIce: vi.fn<Globe['setIce']>(),
    setShelf: vi.fn<Globe['setShelf']>(),
    setSeaIce: vi.fn<Globe['setSeaIce']>(),
  };
  const context = {
    base: '/assets/',
    fetchJson,
    globe,
    notify: vi.fn(),
    redraw: vi.fn(),
    travelling: vi.fn(() => false),
    holoceneShown: vi.fn(),
  } satisfies IceAgesContext;
  const part = mountIceAges(context);
  // Drain the real loader/Response.json promise chain, without polling or wall-clock waits.
  const flush = () => setImmediate();
  async function resolve(file: string, body: unknown = catalogs[file]) {
    const request = pending.get(file);
    if (request === undefined) throw new Error(`No request for ${file}`);
    pending.delete(file);
    request.resolve(Response.json(body));
    await flush();
  }
  async function load() {
    for (const file of [...pending.keys()]) await resolve(file);
  }
  return { part, context, globe, updateOutlines, fetchJson, pending, resolve, load, flush };
}

describe('ice-age feature integration, without a DOM or WebGL', () => {
  it('loads only on demand and shares in-flight and completed catalog requests', async () => {
    const h = harness();
    expect(h.fetchJson).not.toHaveBeenCalled();
    expect(h.part.bar(deep, 0.03).ice.drawn).toBe(false);
    h.part.bar(deep, 0.02);
    expect(h.fetchJson).toHaveBeenCalledTimes(5);
    await h.load();
    expect(h.context.redraw).toHaveBeenCalledTimes(5);
    h.part.bar(deep, 0.03);
    expect(h.fetchJson).toHaveBeenCalledTimes(5);
    expect(h.context.notify).not.toHaveBeenCalled();
  });

  it('converts Ma to ka, blends ice frames and sends the selected coastline to the renderer', async () => {
    const h = harness();
    h.part.bar(deep, 0.03);
    await h.load();
    const view = h.part.bar(deep, 0.03);
    expect(view.coastline).toMatchObject({ seaLevel: -90, label: 'bintanja-2008', instead: null });
    expect(h.globe.setShelf).toHaveBeenLastCalledWith({
      url: '/assets/data/shelf/shelf.png',
      ...grid,
      lowest: -200,
      highest: 55,
      seaLevel: -90,
    });
    expect(view.ice).toEqual({ drawn: true, oldestKa: 40, standIn: null });
    expect(h.globe.setIce.mock.lastCall?.[0]).toMatchObject({
      younger: '/assets/data/icesheets/20000.png',
      older: '/assets/data/icesheets/40000.png',
      ...grid,
      metresPerStep: 16,
    });
    expect(h.globe.setIce.mock.lastCall?.[0]?.mix).toBeCloseTo(0.5, 10);
    expect(view.seaIce?.model).toBe(deep.seaIce);
    // The chosen glacial reference is 21 ka: -117 m in this fixture.
    expect(view.seaIce?.mix).toBeCloseTo(90 / 117, 10);
    expect(h.globe.setSeaIce.mock.lastCall?.[0]?.mix).toBeCloseTo(90 / 117, 10);
    expect(h.globe.setSeaIce.mock.lastCall?.[0]?.season).toBeNull();
  });

  it('uses the latest moment and model after a catalog arrives, not the initiating request', async () => {
    const h = harness();
    h.part.bar(deep, 0.03);
    const current = { ...deep, seaIce: 'miroc-es2l' as const, coast: 'spratt-2016' as const };
    h.context.redraw.mockImplementation(() => {
      h.part.bar(current, 0.02);
    });
    await h.load();
    expect(h.globe.setShelf).toHaveBeenLastCalledWith(expect.objectContaining({ seaLevel: -100 }));
    expect(h.globe.setIce).toHaveBeenLastCalledWith(
      expect.objectContaining({
        older: '/assets/data/icesheets/20000.png',
        mix: 1,
      }),
    );
    expect(h.globe.setSeaIce).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pastMost: '/assets/data/seaice/miroc-es2l-most.png',
        mix: 1,
      }),
    );
  });

  it('shows outlines in their time slice and clears them between slices and outside ice ages', async () => {
    const h = harness();
    h.part.bar(deep, 0.15);
    await h.load();
    expect(h.part.bar(deep, 0.15).iceOutlines).toMatchObject({ name: 'MIS 6' });
    expect(h.updateOutlines).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'MIS 6' }));
    h.part.off(base);
    expect(h.updateOutlines).toHaveBeenLastCalledWith(null);
    h.part.bar(deep, 0.15);
    expect(h.part.bar(deep, 0.12).iceOutlines).toBeNull();
    expect(h.updateOutlines).toHaveBeenLastCalledWith(null);
    h.part.bar({ ...deep, deepScale: 'all' }, 3);
    expect(h.updateOutlines).toHaveBeenLastCalledWith(null);
    expect(h.globe.setIce).toHaveBeenLastCalledWith(null);
    expect(h.globe.setShelf).toHaveBeenLastCalledWith(null);
    expect(h.globe.setSeaIce).toHaveBeenLastCalledWith(null);
    h.part.off(base);
    expect(h.updateOutlines).toHaveBeenLastCalledWith(null);
  });

  it('uses a sea-level-matched stand-in before the ice maps reach and clears it beyond sea-level data', async () => {
    const h = harness();
    h.part.bar(deep, 0.1);
    await h.load();
    expect(h.part.bar(deep, 0.1).ice).toEqual({
      drawn: true,
      oldestKa: 40,
      standIn: { ka: 40, file: '40000.png', frameLevel: -60, level: -60 },
    });
    expect(h.globe.setIce).toHaveBeenLastCalledWith(
      expect.objectContaining({
        younger: '/assets/data/icesheets/40000.png',
        older: '/assets/data/icesheets/40000.png',
        mix: 0,
      }),
    );
    expect(h.part.bar(deep, 0.5).ice).toEqual({ drawn: false, oldestKa: 40, standIn: null });
    expect(h.globe.setIce).toHaveBeenLastCalledWith(null);
    expect(h.globe.setSeaIce).toHaveBeenLastCalledWith(null);
  });

  it('can wait for sea-level data after the ice maps have arrived', async () => {
    const h = harness();
    h.part.bar(deep, 0.1);
    await h.resolve('icesheets/index.json');
    expect(h.part.bar(deep, 0.1).ice.standIn).toBeNull();
    await h.resolve('sealevel/index.json');
    expect(h.part.bar(deep, 0.1).ice.standIn?.ka).toBe(40);
  });

  it.each(Object.keys(catalogs))(
    'reports and retries a failed %s load without duplicate pending requests',
    async (file) => {
      const h = harness();
      h.part.bar(deep, 0.03);
      const request = h.pending.get(file);
      if (request === undefined) throw new Error(file);
      request.reject(new Error('offline'));
      await h.flush();
      expect(h.context.notify).toHaveBeenCalledTimes(1);
      expect(h.context.notify).toHaveBeenCalledWith(expect.stringContaining('offline'));
      h.part.bar(deep, 0.03);
      h.part.bar(deep, 0.03);
      expect(h.fetchJson.mock.calls.filter(([url]) => url.endsWith(file))).toHaveLength(2);
      await h.resolve(file);
      expect(h.context.redraw).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects an invalid catalog through the real loader and recovers on retry', async () => {
    const h = harness();
    h.part.bar(deep, 0.03);
    await h.resolve('icesheets/index.json', { broken: true });
    expect(h.context.notify).toHaveBeenCalledWith(expect.stringContaining('catalog schema'));
    h.part.bar(deep, 0.03);
    await h.resolve('icesheets/index.json');
    expect(h.part.bar(deep, 0.03).ice.drawn).toBe(true);
  });

  it('does not restore ice-age overlays when a load completes after switching to historical time', async () => {
    const h = harness();
    h.part.bar(deep, 0.15);
    h.part.off(base);
    h.context.redraw.mockImplementation(() => {
      h.part.off(base);
    });
    await h.load();
    expect(h.globe.setIce).toHaveBeenLastCalledWith(null);
    expect(h.globe.setShelf).toHaveBeenLastCalledWith(null);
    expect(h.updateOutlines).toHaveBeenLastCalledWith(null);
    expect(h.part.holoceneText()).toBeNull();
    expect(typeof h.globe.setSeaIce.mock.lastCall?.[0]?.season).toBe('number');
    expect(h.globe.setSeaIce).toHaveBeenLastCalledWith(expect.objectContaining({ mix: 0 }));
  });

  it('travels through historical years with their ice and sea level, then clears them on stopping', async () => {
    const h = harness();
    h.context.travelling.mockReturnValue(true);
    const past = defaultViewState(new Date('-018050-03-16T12:00:00Z'));
    h.part.showHolocene(past);
    expect(h.context.holoceneShown).toHaveBeenCalledWith(past);
    await h.load();
    h.part.showHolocene(past);
    expect(h.globe.setShelf).toHaveBeenLastCalledWith(expect.objectContaining({ seaLevel: -120 }));
    expect(h.globe.setIce).toHaveBeenLastCalledWith(
      expect.objectContaining({ older: '/assets/data/icesheets/20000.png', mix: 1 }),
    );
    expect(h.part.holoceneText()).toContain('120 m below');
    h.context.travelling.mockReturnValue(false);
    h.part.showHolocene(base);
    expect(h.part.holoceneText()).toBeNull();
    expect(h.globe.setShelf).toHaveBeenLastCalledWith(null);
    expect(h.globe.setIce).toHaveBeenLastCalledWith(null);
  });

  it('does not show historical land ice or shelves in sky mode, even while travelling', () => {
    const h = harness();
    h.context.travelling.mockReturnValue(true);
    h.part.showHolocene({ ...base, mode: 'sky' });
    expect(h.globe.setShelf).toHaveBeenLastCalledWith(null);
    expect(h.globe.setIce).toHaveBeenLastCalledWith(null);
  });

  it('exposes sea-level series only with the layer on, including outside the ice-age scale', async () => {
    const h = harness();
    const state: ViewState = { ...deep, deepScale: 'all', layers: new Set(['sealevel']) };
    expect(h.part.bar(state, 100).seaLevel).toEqual({ on: true, index: null });
    expect(h.fetchJson).toHaveBeenCalledTimes(1);
    await h.load();
    expect(h.part.bar(state, 100).seaLevel).toEqual({ on: true, index: levels });
    expect(h.part.bar({ ...state, layers: new Set() }, 100).seaLevel).toEqual({ on: false });
  });
});
