import { describe, expect, it, vi } from 'vitest';

import composites from '../../../public/data/enso-composites/index.json';
import file from '../../../public/data/enso/index.json';
import type { Enso } from '../../data/enso';
import { globeMaps } from './globeMaps';

vi.mock('../../util/loadImage', () => ({
  loadImage: (url: string) => Promise.resolve({ width: 361, height: 181, url }),
}));

const enso = file as unknown as Enso;

function setUp() {
  const refresh = vi.fn();
  const painted: unknown[] = [];
  const maps = globeMaps({
    base: '/',
    fetchJson: (url: string) =>
      url.includes('enso-composites')
        ? Promise.resolve(new Response(JSON.stringify(composites)))
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
});
