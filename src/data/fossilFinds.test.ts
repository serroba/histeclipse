import { describe, expect, it } from 'vitest';

import { findsAt, findsOf, oldestFinds } from './fossilFinds';
import { parseLineages } from './lineages';

/**
 * Dinosauria > Theropoda > { Tyrannosaurus (83.6–66: found near 75 Ma in Asia, near 65 Ma at two
 * sites in North America), Coelophysis (227–193) }.
 */
const FILE = {
  schemaVersion: 2,
  credit: 'PBDB',
  source: 'https://paleobiodb.org',
  accessed: '2026-11-09',
  id: 'dinosaurs',
  name: 'Non-avian dinosaurs',
  stepMa: 5,
  ranks: ['family', 'genus', 'clade'],
  pbdb: [1, 2, 3, 4],
  names: ['Dinosauria', 'Theropoda', 'Coelophysis', 'Tyrannosaurus'],
  rank: [2, 2, 1, 1],
  parent: [-1, 0, 1, 1],
  first: [227.3, 227.3, 227.3, 83.6],
  last: [66, 66, 192.9, 66],
  species: [0, 0, 2, 2],
  tracks: [
    [],
    [],
    [195, 24, -18, 1, 200, 18, -36, 2],
    [65, 52, -79, 80, 65, 40, -105, 3, 75, 50, 170, 4],
  ],
};

describe('a genus’s finds on the globe (#309)', () => {
  const lineages = parseLineages(FILE);
  const rex = lineages.nodes[3];
  if (rex === undefined) throw new Error('fixture');

  it('gathers the finds of a genus, or of every genus in a group, to mark on the globe (#309)', () => {
    expect(findsOf(lineages, 3)).toEqual(rex.track);
    // Theropoda: both its genera's finds; Coelophysis's own.
    expect(findsOf(lineages, 1)).toHaveLength(5);
    expect(findsOf(lineages, 2).map((site) => site.ma)).toEqual([200, 195]);
  });

  it('marks the finds of the step, or says where the nearest are (#309)', () => {
    const finds = findsOf(lineages, 1);
    // Near 66 Ma: Tyrannosaurus's two North American sites.
    expect(findsAt(finds, 66, 5)).toEqual({
      sites: [
        { ma: 65, latitude: 52, longitude: -79, finds: 80 },
        { ma: 65, latitude: 40, longitude: -105, finds: 3 },
      ],
      nearest: null,
    });
    // None near 72 Ma: the nearest are 75 Ma's, 3 million years away (65 Ma's are 7).
    expect(findsAt(finds, 72, 5)).toEqual({ sites: [], nearest: 75 });
    // Half way between 65 and 75 Ma's, the older.
    expect(findsAt(rex.track, 70, 5).nearest).toBe(75);
    expect(findsAt([], 70, 5)).toEqual({ sites: [], nearest: null });
  });

  it('opens finds at their oldest step, at its biggest site (#309)', () => {
    expect(oldestFinds(rex.track)).toEqual({ ma: 75, latitude: 50, longitude: 170, finds: 4 });
    expect(oldestFinds(findsOf(lineages, 1))?.ma).toBe(200);
    expect(oldestFinds([])).toBeNull();
    // Of two sites in its oldest step, the one with more finds.
    const two = [
      { ma: 70, latitude: 1, longitude: 1, finds: 2 },
      { ma: 70, latitude: 2, longitude: 2, finds: 9 },
    ];
    expect(oldestFinds(two)?.latitude).toBe(2);
  });
});
