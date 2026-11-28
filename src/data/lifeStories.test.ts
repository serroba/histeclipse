import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { LIFE_GROUPS, loadLife, parseLife } from './lifeStories';

const raw = (id: string): Record<string, unknown> =>
  JSON.parse(readFileSync(`public/data/life-stories/${id}.json`, 'utf8')) as Record<
    string,
    unknown
  >;

/** A file of three nodes: a group, a family in it, and a genus with two sites. */
const small = {
  schemaVersion: 1,
  sources: ['pbdb'],
  credit: 'made for the test',
  licence: 'CC BY 4.0',
  changes: 'made for the test',
  source: 'https://example.org',
  accessed: '2026-11-28',
  id: 'mammals',
  name: 'Mammals',
  stepMa: 5,
  ranks: ['class', 'family', 'genus'],
  regions: ['North America', 'Asia'],
  pbdb: [1, 2, 3],
  names: ['Mammalia', 'Felidae', 'Felis'],
  common: ['mammal', 'cat', ''],
  living: [1, 1, 1],
  rank: [0, 1, 2],
  parent: [-1, 0, 1],
  first: [10, 10, 10],
  last: [0, 0, 0],
  sites: [[], [], [0, 10, 20, 2, 1, 15.5, 10, 30, 40, 7, 0, null, 10, 31, 41, 9, 0, 12]],
  globe: [
    [0, 14.6],
    [10, 15.7],
  ],
};

describe('a fossil group’s genera through time, place and climate', () => {
  it.each(LIFE_GROUPS)('reads the served file of the %s', async (group) => {
    const data = await loadLife(`${group}.json`, () =>
      Promise.resolve(new Response(JSON.stringify(raw(group)))),
    );
    expect(data.id).toBe(group);
    expect(data.nodes.length).toBeGreaterThan(1000);
    expect(data.regions).toHaveLength(7);
    expect(data.nodes[0]?.parent).toBe(-1);
  });

  it('gives each node its rank, its children and whether it lives', () => {
    const data = parseLife(small);
    const [group, family, genus] = data.nodes;
    expect(group?.children).toEqual([1]);
    expect(family).toMatchObject({ name: 'Felidae', common: 'cat', rank: 'family', children: [2] });
    expect(genus).toMatchObject({ pbdb: 3, rank: 'genus', parent: 1, living: true });
    expect(data.globe.get(10)).toBe(15.7);
  });

  it('reads a genus’s sites oldest first, the most finds first within a step', () => {
    const [, , genus] = parseLife(small).nodes;
    expect(genus?.sites).toEqual([
      { ma: 10, latitude: 31, longitude: 41, finds: 9, region: 0, celsius: 12 },
      { ma: 10, latitude: 30, longitude: 40, finds: 7, region: 0, celsius: null },
      { ma: 0, latitude: 10, longitude: 20, finds: 2, region: 1, celsius: 15.5 },
    ]);
  });

  it('refuses a file whose columns differ in length, or whose nodes come before their parents', () => {
    expect(() => parseLife({ ...small, common: ['mammal'] })).toThrow();
    expect(() => parseLife({ ...small, parent: [-1, 2, 1] })).toThrow();
    expect(() => parseLife({ ...small, parent: [0, 0, 1] })).toThrow();
    expect(() => parseLife({ ...small, rank: [0, 1, 9] })).toThrow();
  });

  it('refuses sites that are not whole, or that lack a moment, a place, finds or a region', () => {
    expect(() => parseLife({ ...small, sites: [[], [], [0, 10, 20]] })).toThrow();
    expect(() => parseLife({ ...small, sites: [[], [], [0, 10, 20, 2, null, 15]] })).toThrow(
      'Felis: a site lacks its moment, place, finds or region',
    );
  });
});
