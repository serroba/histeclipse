import { describe, expect, it } from 'vitest';

import aadr from '../../public/data/genomes/aadr.json';
import {
  genomesNear,
  genomesNote,
  loadAncientGenomes,
  yearSpanText,
  type AncientGenomes,
} from './ancientGenomes';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

const small: AncientGenomes = {
  schemaVersion: 1,
  credit: 'AADR',
  source: 'https://doi.org/10.7910/DVN/FFIDCW',
  version: 'v66.p1',
  cellDegrees: 2,
  cells: [
    [50, 86],
    [40, 10],
  ],
  groups: ['Italy_BA', 'Russia_Afanasievo'],
  papers: [{ name: 'P', doi: '10.1/p' }],
  genomes: [
    [0, 4450, 1, 0],
    [0, 4500, 1, 0],
    [1, 4400, 0, 0],
    [1, 1000, 0, 0],
  ],
};

describe('ancient genomes', () => {
  it('load and check, the real file too', async () => {
    await expect(loadAncientGenomes('x', serve(small))).resolves.toEqual(small);
    const data = await loadAncientGenomes('aadr.json', serve(aadr));
    expect(data.genomes.length).toBeGreaterThan(10_000);
    const bad = { ...small, genomes: [[0, -5, 0, 0]] };
    await expect(loadAncientGenomes('x', serve(bad))).rejects.toThrow();
  });

  it('counts the genomes near a year by region, most first, with the lab labels', () => {
    // 2500 BCE is astronomical −2499; 4450 BP is 2501 BCE.
    const near = genomesNear(small, -2499);
    expect(near.total).toBe(3);
    expect(near.cells).toEqual([
      { latitude: 51, longitude: 87, count: 2, labels: [['Russia_Afanasievo', 2]], papers: 1 },
      { latitude: 41, longitude: 11, count: 1, labels: [['Italy_BA', 1]], papers: 1 },
    ]);
    expect(genomesNear(small, 1000).total).toBe(1);
    expect(genomesNear(small, 1900).cells).toEqual([]);
  });

  it('says what is counted', () => {
    expect(genomesNote(genomesNear(small, -2499))).toBe(
      '3 genomes dated 2750–2250 BCE, in 2 regions: where genomes have been sequenced, not how many people lived. Labels are the lab’s, not peoples.',
    );
  });

  it('writes spans in one era or across two', () => {
    expect(yearSpanText(-2749, -2249)).toBe('2750–2250 BCE');
    expect(yearSpanText(1000, 1500)).toBe('1000–1500 CE');
    expect(yearSpanText(-249, 250)).toBe('250 BCE–250 CE');
  });
});
