import { describe, expect, it, vi } from 'vitest';

import file from '../../../public/data/enso-composites/index.json';
import type { PackedMonth } from './ensoMapLayer';
import { compositeMaps } from './compositeMaps';

const loaded = vi.hoisted(() => ({ fail: false, urls: [] as string[] }));
vi.mock('../../util/loadImage', () => ({
  loadImage: (url: string) => {
    loaded.urls.push(url);
    return loaded.fail
      ? Promise.reject(new Error('offline'))
      : Promise.resolve({ width: 361, height: 181, url });
  },
}));

const RAIN = { variable: 'rain', phase: 'laNina', season: 'jja' } as const;

function setUp(options: { readonly failing?: boolean } = {}) {
  loaded.urls.length = 0;
  loaded.fail = false;
  const painted: (PackedMonth | null)[] = [];
  const notify = vi.fn();
  const refresh = vi.fn();
  const fetchJson = vi.fn(() =>
    options.failing === true
      ? Promise.reject(new Error('offline'))
      : Promise.resolve(new Response(JSON.stringify(file))),
  );
  const maps = compositeMaps({
    folder: '/data/enso-composites/',
    fetchJson,
    paint: (packed) => painted.push(packed),
    notify,
    refresh,
  });
  return { maps, painted, notify, refresh, fetchJson };
}

describe('the composite maps', () => {
  it('Given the index loads once, Then a pick paints its map by the index, coloured on its own scale', async () => {
    const { maps, painted, refresh, fetchJson } = setUp();
    maps.show(RAIN, 'roni');
    expect(painted).toEqual([]);
    maps.load();
    maps.load();
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    maps.load();
    expect(fetchJson).toHaveBeenCalledOnce();
    maps.show(RAIN, 'roni');
    maps.show(RAIN, 'roni');
    await vi.waitFor(() => {
      expect(painted.at(-1)?.bound).toBe(2);
    });
    expect(loaded.urls).toEqual(['/data/enso-composites/rain-roni-laNina-jja.png']);
    const colours = painted.at(-1)?.colours;
    expect(colours?.(new Uint8ClampedArray([255, 128, 255, 255]), 2)[0]).toBe(1);
    maps.show(null, 'roni');
    maps.show(RAIN, 'nope');
    expect(maps.index()?.maps).toHaveLength(16);
  });

  it('Given the index or a map does not load, Then it says so, and asks again next time', async () => {
    const failing = setUp({ failing: true });
    failing.maps.load();
    await vi.waitFor(() => {
      expect(failing.notify).toHaveBeenCalledWith(
        'Could not load the El Niño rain and temperature maps: offline',
      );
    });
    failing.maps.load();
    expect(failing.fetchJson).toHaveBeenCalledTimes(2);
    const { maps, notify, refresh, painted } = setUp();
    maps.load();
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    loaded.fail = true;
    maps.show(RAIN, 'oni');
    maps.show({ ...RAIN, season: 'djf' }, 'oni');
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the El Niño map: offline');
    });
    expect(painted.every((each) => each === null)).toBe(true);
  });
});
