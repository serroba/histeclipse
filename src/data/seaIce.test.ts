import { describe, expect, it } from 'vitest';

import index from '../../public/data/seaice/index.json';
import type { Fetch } from './fetchJson';
import { loadSeaIce, SEA_ICE_MODELS, seaIceMix, seaIcePair } from './seaIce';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));

describe('sea ice', () => {
  it('has today’s and each model’s ice-age sea ice, credited', async () => {
    const loaded = await loadSeaIce('/x', serve(index));
    for (const model of SEA_ICE_MODELS) {
      const pair = seaIcePair(loaded, model);
      expect(pair?.today.credit).toContain('NSIDC');
      expect(pair?.past.credit).toContain('CC BY 4.0');
    }
    // Ice-age sea ice spread further than today's in at least two of the three models.
    const today = loaded.sources.find(({ era }) => era === 'today')?.extent ?? 1;
    const wider = loaded.sources.filter(({ era, extent }) => era === 'lgm' && extent > today);
    expect(wider.length).toBeGreaterThanOrEqual(2);
  });

  it('refuses an index without exactly one source of today’s', async () => {
    const twice = { ...index, sources: [...index.sources, index.sources[0]] };
    await expect(loadSeaIce('/x', serve(twice))).rejects.toThrow('exactly one');
    const loaded = await loadSeaIce('/x', serve(index));
    expect(seaIcePair({ ...loaded, sources: loaded.sources.slice(0, 1) }, 'miroc-es2l')).toBeNull();
  });

  it('blends by how far the sea had fallen towards its glacial low', () => {
    expect(seaIceMix(0, -120)).toBe(0);
    expect(seaIceMix(-60, -120)).toBe(0.5);
    expect(seaIceMix(-130, -120)).toBe(1);
    expect(seaIceMix(5, -120)).toBe(0);
    expect(seaIceMix(-10, 0)).toBe(0);
  });
});
