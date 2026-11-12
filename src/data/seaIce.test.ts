import { describe, expect, it } from 'vitest';

import index from '../../public/data/seaice/index.json';
import type { Fetch } from '../util/fetchJson';
import { loadSeaIce, SEA_ICE_MODELS, seaIceMix, seaIcePair, seaIceSeason } from './seaIce';

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

describe('the time of year for sea ice', () => {
  // Julian days at noon UT.
  const MID_MARCH_2026 = 2_461_116; // 16 March 2026
  const MID_SEPTEMBER_2026 = 2_461_299; // 15 September 2026
  const NOVEMBER_384 = 1_861_629; // 11 November 384, Julian calendar

  it('is the north’s March ice in March and its September ice in September', () => {
    expect(seaIceSeason(MID_MARCH_2026)).toBeGreaterThan(0.99);
    expect(seaIceSeason(MID_SEPTEMBER_2026)).toBeLessThan(0.01);
  });

  it('has the north’s ice growing again by November', () => {
    const season = seaIceSeason(NOVEMBER_384);
    expect(season).toBeGreaterThan(0.15);
    expect(season).toBeLessThan(0.35);
  });

  it('keeps to the seasons, not to the Julian calendar’s longer year', () => {
    // 5,000 Julian years later the calendar has drifted about 39 days from the seasons.
    const julianYears = 5000 * 365.25;
    expect(seaIceSeason(MID_MARCH_2026 - julianYears)).toBeLessThan(0.9);
    expect(seaIceSeason(MID_MARCH_2026 - 5000 * 365.242_19)).toBeGreaterThan(0.99);
  });
});
