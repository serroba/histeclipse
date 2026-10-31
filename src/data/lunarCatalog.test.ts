import { describe, expect, it } from 'vitest';

import { astronomicalYear } from '../time/year';
import { CatalogError, LunarCatalog, yearOf, type Fetch } from './lunarCatalog';

// The real catalog files, exactly as the site serves them.
const files = import.meta.glob<unknown>('../../public/data/lunar/*.json', {
  eager: true,
  import: 'default',
});
const BASE = '/data/lunar/';
const served = new Map(
  Object.entries(files).map(([path, json]) => [
    `${BASE}${path.slice(path.lastIndexOf('/') + 1)}`,
    json,
  ]),
);

function fakeFetch(overrides = new Map<string, Response>()): Fetch & { calls: string[] } {
  const calls: string[] = [];
  const fetchJson = (url: string): Promise<Response> => {
    calls.push(url);
    const override = overrides.get(url);
    if (override !== undefined) return Promise.resolve(override);
    const body = served.get(url);
    return Promise.resolve(
      body === undefined ? new Response(null, { status: 404 }) : Response.json(body),
    );
  };
  return Object.assign(fetchJson, { calls });
}

describe('committed catalog files', () => {
  it('all match the schema and agree with the index', async () => {
    const catalog = await LunarCatalog.load(BASE, fakeFetch());
    const { index } = catalog;
    expect(index.chunks).toHaveLength(71);
    expect(served.size).toBe(index.chunks.length + 1);

    let total = 0;
    for (let year = index.startYear; year <= index.endYear; year += index.yearsPerChunk) {
      total += (await catalog.eclipsesInYear(astronomicalYear(year))).length;
    }
    const counts = index.chunks.reduce((sum, chunk) => sum + chunk.count, 0);
    expect(counts).toBe(16_872);
    expect(total).toBeGreaterThan(0);
  });

  it('puts every eclipse in the chunk for its year', async () => {
    const catalog = await LunarCatalog.load(BASE, fakeFetch());
    for (const entry of catalog.index.chunks) {
      const json = served.get(`${BASE}${entry.file}`);
      expect(Array.isArray(json) ? json.length : -1).toBe(entry.count);
    }
  });
});

describe('LunarCatalog', () => {
  it('finds the eclipse Ptolemy records for Nabopolassar year 5 (621 BCE)', async () => {
    const catalog = await LunarCatalog.load(BASE, fakeFetch());
    const eclipses = await catalog.eclipsesInYear(astronomicalYear(-620));
    const april = eclipses.find((eclipse) => Math.abs(eclipse.jdTT - 1_494_714.806) < 0.01);
    expect(april).toMatchObject({ kind: 'partial', umbralMagnitude: 0.1491 });
    expect(eclipses.every((eclipse) => yearOf(eclipse.jdTT) === -620)).toBe(true);
  });

  it('lists the two total lunar eclipses of 2025 in time order', async () => {
    const catalog = await LunarCatalog.load(BASE, fakeFetch());
    const eclipses = await catalog.eclipsesInYear(astronomicalYear(2025));
    expect(eclipses.map((eclipse) => eclipse.kind)).toEqual(['total', 'total']);
    // NASA's canon puts the Moon overhead at 3°N 102°W (rounded to whole degrees).
    const [latitude, longitude] = eclipses[0]?.sublunar ?? [Number.NaN, Number.NaN];
    expect(Math.abs(latitude - 3)).toBeLessThan(0.6);
    expect(Math.abs(longitude - -102)).toBeLessThan(0.6);
  });

  it('fetches each chunk once', async () => {
    const fetchJson = fakeFetch();
    const catalog = await LunarCatalog.load(BASE, fetchJson);
    await Promise.all([
      catalog.eclipsesInYear(astronomicalYear(2024)),
      catalog.eclipsesInYear(astronomicalYear(2025)),
    ]);
    await catalog.eclipsesInYear(astronomicalYear(2099));
    expect(fetchJson.calls).toEqual([`${BASE}index.json`, `${BASE}2000.json`]);
  });

  it('rejects years outside the catalog', async () => {
    const catalog = await LunarCatalog.load(BASE, fakeFetch());
    expect(catalog.covers(astronomicalYear(3001))).toBe(false);
    await expect(catalog.eclipsesInYear(astronomicalYear(3001))).rejects.toThrow(
      /3001 CE is outside the catalog/,
    );
  });

  it('reports HTTP failures and retries afterwards', async () => {
    const overrides = new Map([[`${BASE}2000.json`, new Response(null, { status: 503 })]]);
    const fetchJson = fakeFetch(overrides);
    const catalog = await LunarCatalog.load(BASE, fetchJson);
    await expect(catalog.eclipsesInYear(astronomicalYear(2025))).rejects.toThrow(
      new CatalogError(`GET ${BASE}2000.json failed: HTTP 503`),
    );
    overrides.clear();
    await expect(catalog.eclipsesInYear(astronomicalYear(2025))).resolves.toHaveLength(2);
  });

  it('rejects files that do not match the schema, naming the bad field', async () => {
    const bad = [{ ...(served.get(`${BASE}2000.json`) as object[])[0], kind: 'annular' }];
    const fetchJson = fakeFetch(new Map([[`${BASE}2000.json`, Response.json(bad)]]));
    const catalog = await LunarCatalog.load(BASE, fetchJson);
    await expect(catalog.eclipsesInYear(astronomicalYear(2025))).rejects.toThrow(
      /2000\.json does not match the catalog schema at 0\.kind/,
    );
  });

  it('rejects a chunk that is not a list', async () => {
    const fetchJson = fakeFetch(new Map([[`${BASE}2000.json`, Response.json({})]]));
    const catalog = await LunarCatalog.load(BASE, fetchJson);
    await expect(catalog.eclipsesInYear(astronomicalYear(2025))).rejects.toThrow(
      /does not match the catalog schema at \(root\)/,
    );
  });

  it('rejects an index from a newer schema version', async () => {
    const index = { ...(served.get(`${BASE}index.json`) as object), schemaVersion: 2 };
    const fetchJson = fakeFetch(new Map([[`${BASE}index.json`, Response.json(index)]]));
    await expect(LunarCatalog.load(BASE, fetchJson)).rejects.toThrow(/at schemaVersion/);
  });

  it('rejects an index that is missing a chunk', async () => {
    const index = served.get(`${BASE}index.json`) as { chunks: { startYear: number }[] };
    const trimmed = { ...index, chunks: index.chunks.filter((c) => c.startYear !== 2000) };
    const fetchJson = fakeFetch(new Map([[`${BASE}index.json`, Response.json(trimmed)]]));
    const catalog = await LunarCatalog.load(BASE, fetchJson);
    await expect(catalog.eclipsesInYear(astronomicalYear(2025))).rejects.toThrow(
      'Index lists no chunk for 2000',
    );
  });
});
