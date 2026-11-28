import { describe, expect, it, vi } from 'vitest';

import type { EnsoSst } from '../../data/ensoSst';
import { seaMaps } from './seaMaps';

const loaded = vi.hoisted(() => ({ fail: false, urls: [] as string[] }));
vi.mock('../../util/loadImage', () => ({
  loadImage: (url: string) => {
    loaded.urls.push(url);
    return loaded.fail
      ? Promise.reject(new Error('offline'))
      : Promise.resolve({ width: 361, height: 181, url });
  },
}));

const MAPS: EnsoSst = {
  schemaVersion: 1,
  credit: 'c',
  source: 'https://example.org/',
  paper: 'https://example.org/paper',
  licence: 'l',
  accessed: '2026-11-19',
  units: '°C',
  baseline: '1991–2020',
  bound: 4,
  encoding: 'e',
  files: 'YYYY-MM.png',
  first: '1981-09',
  last: '2026-10',
  columns: 361,
  rows: 181,
};
const month = (year: number, number: number): number => year * 12 + number - 1;

function setUp(options: { readonly failing?: boolean } = {}) {
  loaded.urls.length = 0;
  loaded.fail = false;
  const painted: unknown[] = [];
  const notify = vi.fn();
  const refresh = vi.fn();
  const sea = seaMaps({
    folder: '/data/enso-sst/',
    fetchJson: () =>
      options.failing === true
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify(MAPS))),
    paint: (packed) =>
      painted.push(packed === null ? null : (packed.image as unknown as { url: string }).url),
    notify,
    refresh,
  });
  return { sea, painted, notify, refresh };
}

describe('the sea temperature maps behind El Niño', () => {
  it('Given it off, Then nothing is painted or loaded', () => {
    const { sea, painted } = setUp();
    sea.show(false, month(1997, 12));
    // Nothing of these was painted, so nothing is taken away (#1045).
    expect(painted).toEqual([]);
    expect(sea.index()).toBeNull();
  });

  it('Given it on, Then the index loads once, then each month’s map, kept for going back', async () => {
    const { sea, painted, refresh } = setUp();
    sea.show(true, month(1997, 12));
    sea.show(true, month(1997, 12));
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    sea.show(true, month(1997, 12));
    await vi.waitFor(() => {
      expect(painted).toEqual(['/data/enso-sst/1997-12.png']);
    });
    sea.show(true, month(1998, 1));
    await vi.waitFor(() => {
      expect(painted.at(-1)).toBe('/data/enso-sst/1998-01.png');
    });
    sea.show(true, month(1997, 12));
    expect(painted.at(-1)).toBe('/data/enso-sst/1997-12.png');
    // Each month once, and the next three fetched ahead of the one shown (#915).
    expect(loaded.urls).toEqual([
      '/data/enso-sst/1997-12.png',
      '/data/enso-sst/1998-01.png',
      '/data/enso-sst/1998-02.png',
      '/data/enso-sst/1998-03.png',
      '/data/enso-sst/1998-04.png',
    ]);
  });

  it('Given a month before the maps, Then nothing is painted, and a map painted is taken away', async () => {
    const { sea, painted, refresh } = setUp();
    sea.show(true, month(1970, 1));
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    sea.show(true, month(1970, 1));
    expect(painted).toEqual([]);
    sea.show(true, month(1997, 12));
    await vi.waitFor(() => {
      expect(painted).toEqual(['/data/enso-sst/1997-12.png']);
    });
    sea.show(true, month(1970, 1));
    sea.show(true, month(1970, 1));
    expect(painted).toEqual(['/data/enso-sst/1997-12.png', null]);
  });

  it('Given a month moved past before its map loads, Then that map is kept but not painted', async () => {
    const { sea, painted, refresh } = setUp();
    sea.show(true, month(2000, 1));
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    sea.show(true, month(2000, 1));
    sea.show(true, month(1960, 1));
    await Promise.resolve();
    await Promise.resolve();
    expect(painted).toEqual([]);
  });

  it('Given the index or a map does not load, Then it says so, and the index is not fetched again at the next month (#762)', async () => {
    const { sea, notify } = setUp({ failing: true });
    sea.show(true, month(2000, 1));
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the sea temperature maps: offline');
    });
    sea.show(true, month(2000, 2));
    sea.show(true, month(2000, 3));
    expect(notify).toHaveBeenCalledOnce();
    const other = setUp();
    other.sea.show(true, month(2000, 1));
    await vi.waitFor(() => {
      expect(other.refresh).toHaveBeenCalledOnce();
    });
    loaded.fail = true;
    other.sea.show(true, month(2000, 1));
    await vi.waitFor(() => {
      expect(other.notify).toHaveBeenCalledWith('Could not load the sea temperature map: offline');
    });
  });

  it('Given the month shown loads, Then the feature is asked to show again, and showing it again repaints nothing (#1293)', async () => {
    const { sea, painted, refresh } = setUp();
    sea.show(true, month(1997, 12));
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    sea.show(true, month(1997, 12));
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });
    expect(painted).toEqual(['/data/enso-sst/1997-12.png']);
    // What a refresh does: the same month shown again, painted once all the same.
    sea.show(true, month(1997, 12));
    expect(painted).toEqual(['/data/enso-sst/1997-12.png']);
    // Months fetched ahead ask for nothing: they are not shown.
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(2);
    // Off and on again, it is painted again.
    sea.show(false, month(1997, 12));
    sea.show(true, month(1997, 12));
    expect(painted).toEqual(['/data/enso-sst/1997-12.png', null, '/data/enso-sst/1997-12.png']);
  });

  it('Given more months than it keeps, Then the oldest is loaded again', async () => {
    const { sea, painted, refresh } = setUp();
    sea.show(true, month(2000, 1));
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    for (let step = 0; step <= 36; step += 1) {
      sea.show(true, month(2000, 1) + step);
      await vi.waitFor(() => {
        expect(painted).toHaveLength(step + 1);
      });
    }
    sea.show(true, month(2000, 1));
    await vi.waitFor(() => {
      expect(loaded.urls.filter((url) => url.endsWith('2000-01.png'))).toHaveLength(2);
    });
  });
});
