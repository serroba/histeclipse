import { describe, expect, it } from 'vitest';

import aadr from '../../public/data/genomes/aadr.json';
import type { Person } from './genomePeople';
import {
  cellRows,
  genomeCellCard,
  genomesNear,
  genomesNote,
  loadAncientGenomes,
  peopleFilesFor,
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
  peopleChunk: 2,
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
      {
        cell: 0,
        latitude: 51,
        longitude: 87,
        count: 2,
        labels: [['Russia_Afanasievo', 2]],
        papers: 1,
      },
      { cell: 1, latitude: 41, longitude: 11, count: 1, labels: [['Italy_BA', 1]], papers: 1 },
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

describe('genomeCellCard', () => {
  const many: AncientGenomes = {
    ...small,
    cells: [[-4, -72]],
    groups: Array.from({ length: 10 }, (_, i) => `Group_${String(i)}`),
    papers: [
      { name: 'LinkedPaper2020', doi: 'https://doi.org/10.1/p' },
      { name: 'UnlinkedPaper2026', doi: 'No electronic version' },
    ],
    genomes: [
      ...Array.from(
        { length: 10 },
        (_, i) => [0, 1000 + i, i, 0] as [number, number, number, number],
      ),
      [0, 1000, 0, 0],
      [0, 1000, 0, 1],
    ],
  };

  it('lists a region’s genomes near the year by lab label and by paper, linked by DOI', () => {
    const card = genomeCellCard(many, 0, 950);
    expect(card?.title).toBe('Ancient genomes, 4°S–2°S, 72°W–70°W');
    expect(card?.facts).toEqual([
      ['Genomes', '12'],
      ['Dated', '941–950 CE'],
      [
        'Lab labels',
        'Group_0 ×3, Group_1 ×1, Group_2 ×1, Group_3 ×1, Group_4 ×1, Group_5 ×1, Group_6 ×1, Group_7 ×1, and 2 more',
      ],
      ['Published in', 'LinkedPaper2020, UnlinkedPaper2026'],
    ]);
    expect(card?.links).toEqual([
      { label: 'LinkedPaper2020', href: 'https://doi.org/10.1/p' },
      { label: 'Allen Ancient DNA Resource', href: 'https://doi.org/10.7910/DVN/FFIDCW' },
    ]);
    expect(card?.note).toContain('not how many people lived');
  });

  it('finds a region’s rows near the year, and the files of people they are in', () => {
    expect(cellRows(small, 0, -2499)).toEqual([0, 1]);
    expect(cellRows(small, 1, 950)).toEqual([3]);
    expect(peopleFilesFor(small, [0, 1, 3])).toEqual([0, 1]);
  });

  it('lists each person whose file has come, oldest first, with their archive', () => {
    const person = (id: string): Person => [
      id,
      'Chavín, Peru',
      null,
      null,
      null,
      'female',
      null,
      'B2',
      null,
      null,
      null,
      null,
      null,
      'PRJEB1',
      null,
    ];
    const card = genomeCellCard(many, 0, 950, (row) =>
      row < 2 ? person(`I${String(row)}`) : undefined,
    );
    expect(card?.facts.slice(4)).toEqual([
      ['Genetic sex', '2 female, 0 male'],
      ['mtDNA lines (mothers’ mothers)', 'B2 ×2'],
      ['I1', 'female · mt B2 · Chavín, Peru'],
      ['I0', 'female · mt B2 · Chavín, Peru'],
    ]);
    expect(card?.links).toContainEqual({
      label: 'Reads: PRJEB1',
      href: 'https://www.ebi.ac.uk/ena/browser/view/PRJEB1',
    });
  });

  it('has no card for a region with no genomes near the year', () => {
    expect(genomeCellCard(many, 0, -5000)).toBeNull();
  });
});
