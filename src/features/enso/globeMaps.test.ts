import { describe, expect, it, vi } from 'vitest';

import composites from '../../../public/data/enso-composites/index.json';
import file from '../../../public/data/enso/index.json';
import type { Enso } from '../../data/enso';
import { globeMaps } from './globeMaps';

vi.mock('../../util/loadImage', () => ({
  loadImage: (url: string) => Promise.resolve({ width: 361, height: 181, url }),
}));

// Every node: the top of the scale, significant, with data; none where the canvas cannot read.
const reading = vi.hoisted(() => ({ canvas: true }));
vi.mock('./pixels', () => ({
  pixelsOf: () => (reading.canvas ? new Uint8ClampedArray(361 * 181 * 4).fill(255) : null),
}));

const SST = {
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

const enso = file as unknown as Enso;

function setUp(sea = false) {
  const refresh = vi.fn();
  const painted: unknown[] = [];
  const maps = globeMaps({
    base: '/',
    fetchJson: (url: string) =>
      url.includes('enso-composites')
        ? Promise.resolve(new Response(JSON.stringify(composites)))
        : sea
          ? Promise.resolve(new Response(JSON.stringify(SST)))
          : Promise.reject(new Error('offline')),
    paint: (packed) => painted.push(packed),
    notify: () => undefined,
    refresh,
  });
  return { maps, refresh, painted };
}

describe('what the globe shows of El Niño and La Niña', () => {
  it('Given nothing loaded, Then only the sea is offered, with no scale yet, and a pick waits', () => {
    const { maps, refresh } = setUp();
    maps.pick('rain-elNino-djf', '');
    expect(refresh).toHaveBeenCalledOnce();
    const { map, sea } = maps.view(enso, 0);
    expect(map).toMatchObject({ chosen: 'sea', ends: '', indices: [], by: 'roni', scale: 'sea' });
    expect(map.options).toHaveLength(1);
    expect(sea).toBe('Loading the sea temperature maps…');
  });

  it('Given the composites loaded, Then all are offered; an unknown pick is the sea; a pick keeps its index', async () => {
    const { maps, refresh } = setUp();
    maps.show(true, 0);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    expect(maps.view(enso, 0).map.options).toHaveLength(9);
    maps.pick('nothing', 'oni');
    expect(maps.view(enso, 0).map).toMatchObject({ chosen: 'sea', by: 'oni' });
    maps.pick('rain-laNina-jja', '');
    expect(maps.view(enso, 0).map).toMatchObject({
      chosen: 'rain-laNina-jja',
      by: 'oni',
      scale: 'rain',
      ends: '−2 · 0 · +2 mm a day',
    });
    expect(maps.view(enso, 0).sea).toMatch(/^On the globe: Rain in La Niña’s June–August, by ONI/);
  });

  it('Given a place, Then the sea there this month and what El Niño and La Niña usually bring, once loaded (#893)', async () => {
    reading.canvas = true;
    const { maps, refresh } = setUp(true);
    const place = { latitude: 0, longitude: -120 };
    const january = 2025 * 12;
    expect(maps.here(place, january)).toBeNull();
    maps.show(true, january);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });
    maps.show(true, january);
    expect(maps.here(place, january)).toBeNull();
    await vi.waitFor(() => {
      expect(maps.here(place, january)).toMatch(
        /^The sea’s surface here in January 2025: \+4\.0 °C .* What El Niño and La Niña have usually brought here in December–February, against the trend: El Niño by RONI, rain \+2\.00 mm a day, temperature \+1\.00 °C; by ONI, /,
      );
    });
    reading.canvas = false;
    expect(maps.here(place, january)).toBeNull();
    reading.canvas = true;
  });
});
