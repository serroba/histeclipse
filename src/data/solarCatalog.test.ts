import { describe, expect, it } from 'vitest';

import { astronomicalYear } from '../time/year';
import { LunarCatalog } from './lunarCatalog';
import { SolarCatalog } from './solarCatalog';
import type { Fetch } from './catalog';

const files = import.meta.glob<unknown>('../../public/data/*/*.json', {
  eager: true,
  import: 'default',
});
const served = new Map(
  Object.entries(files).map(([path, json]) => [path.replace('../../public', ''), json]),
);

const fetchServed: Fetch = (url) => {
  const body = served.get(url);
  return Promise.resolve(
    body === undefined ? new Response(null, { status: 404 }) : Response.json(body),
  );
};

describe('SolarCatalog', () => {
  it('validates every committed file against the schema', async () => {
    const catalog = await SolarCatalog.load('/data/solar/', fetchServed);
    expect(catalog.index.kind).toBe('solar');
    expect(catalog.index.chunks.reduce((sum, chunk) => sum + chunk.count, 0)).toBe(16_635);
    for (let year = catalog.index.startYear; year <= catalog.index.endYear; year += 100) {
      await catalog.eclipsesInYear(astronomicalYear(year));
    }
  });

  it('lists 2024’s eclipses: the total of April 8 and the annular of October 2', async () => {
    const catalog = await SolarCatalog.load('/data/solar/', fetchServed);
    const eclipses = await catalog.eclipsesInYear(astronomicalYear(2024));
    expect(eclipses.map((eclipse) => eclipse.kind)).toEqual(['total', 'annular']);
    expect(eclipses[0]?.elements.l2[0]).toBeLessThan(0);
  });

  it('refuses to read one kind of catalog as another', async () => {
    await expect(SolarCatalog.load('/data/lunar/', fetchServed)).rejects.toThrow(
      '/data/lunar/index.json is a lunar catalog, not solar',
    );
    await expect(LunarCatalog.load('/data/solar/', fetchServed)).rejects.toThrow(/not lunar/);
  });
});
