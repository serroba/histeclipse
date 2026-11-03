import { describe, expect, it } from 'vitest';

import data from '../../public/data/ways-of-life.json';
import { loadWaysOfLife, waysAt, waysNote, type WaysOfLife } from './waysOfLife';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

const none = [0, 0, 0];
const small: WaysOfLife = {
  schemaVersion: 1,
  credit: 'ArchaeoGLOBE',
  source: 'https://doi.org/10.1126/science.aax1192',
  scale: 100,
  years: [-8050, -2050, 1850],
  ways: ['foraging', 'pastoralism', 'extensive', 'intensive', 'urban'],
  regions: [
    {
      id: 1,
      name: 'Valley',
      rings: [[0, 0, 100, 0, 100, 100]],
      levels: {
        foraging: [3, 2, 1],
        pastoralism: none,
        extensive: [1, 2, 3],
        intensive: none,
        urban: none,
      },
    },
    {
      id: 2,
      name: 'Empty',
      rings: [[0, 0, 100, 0, 100, 100]],
      levels: {
        foraging: [0, 0, 0],
        pastoralism: none,
        extensive: none,
        intensive: none,
        urban: none,
      },
    },
  ],
};

describe('ways of life', () => {
  it('load and check, the real file too', async () => {
    const loaded = await loadWaysOfLife('ways.json', serve(data));
    expect(loaded.regions).toHaveLength(146);
    await expect(loadWaysOfLife('x', serve({ ...small, ways: ['a'] }))).rejects.toThrow();
  });

  it('colour each region by its most widespread way at the nearest moment rated', () => {
    const early = waysAt(small, -7000);
    expect(early.year).toBe(-8050);
    expect(early.regions.map((region) => [region.name, region.way, region.level])).toEqual([
      ['Valley', 'foraging', 3],
    ]);
    // Equally common: mixed, naming both, rather than one picked.
    const tied = waysAt(small, -2000).regions[0];
    expect(tied?.way).toBe('mixed');
    expect(tied?.ways).toEqual(['foraging', 'extensive']);
    expect(waysAt(small, 1900).counts).toEqual({
      foraging: 0,
      pastoralism: 0,
      extensive: 1,
      intensive: 0,
      urban: 0,
      mixed: 0,
    });
    expect(waysAt(small, 0).regions[0]?.rings).toEqual([
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    ]);
  });

  it('say which moment is shown and what is most widespread', () => {
    expect(waysNote(waysAt(small, -2000), (year) => `year ${String(year)}`)).toBe(
      'As rated for year -2050, the nearest moment ArchaeoGLOBE rates; the most widespread way of life, by region: mixed, several as widespread 1.',
    );
    expect(waysNote(waysAt(small, 1900), (year) => `year ${String(year)}`)).toContain('farming 1.');
  });

  it('show foraging everywhere 10,000 years ago, and farming spread by 1850, in the real file', async () => {
    const loaded = await loadWaysOfLife('ways.json', serve(data));
    const early = waysAt(loaded, -8050);
    expect(early.counts.foraging).toBeGreaterThan(100);
    const late = waysAt(loaded, 1850);
    expect(late.counts.extensive + late.counts.intensive + late.counts.urban).toBeGreaterThan(
      late.counts.foraging,
    );
  });
});
