import { describe, expect, it } from 'vitest';

import ammonoids from '../../public/data/time-tree/ammonoids.json';
import dinosaurs from '../../public/data/time-tree/dinosaurs.json';
import mammals from '../../public/data/time-tree/mammals.json';
import trilobites from '../../public/data/time-tree/trilobites.json';

import {
  aliveAt,
  ancestry,
  colourGroups,
  isWithin,
  LINEAGE_GROUPS,
  fanLayout,
  origins,
  parseLineages,
  sitesAt,
} from './lineages';

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

describe('parseLineages', () => {
  it('reads nodes with their children and tracks, oldest point first', () => {
    const lineages = parseLineages(FILE);
    const [root, theropods, coelophysis] = lineages.nodes;
    expect(root?.children).toEqual([1]);
    expect(theropods?.children).toEqual([2, 3]);
    // Each site at its step's middle (a map's age), oldest first.
    expect(coelophysis?.track.map((point) => point.ma)).toEqual([200, 195]);
    expect(coelophysis?.rank).toBe('genus');
  });

  it('rejects a node listed before its parent or a column of the wrong length', () => {
    expect(() => parseLineages({ ...FILE, parent: [-1, 2, 1, 1] })).toThrow();
    expect(() => parseLineages({ ...FILE, species: [0] })).toThrow();
  });

  it('reads the files the pipeline wrote', () => {
    const files: Record<string, unknown> = { trilobites, ammonoids, dinosaurs, mammals };
    for (const group of LINEAGE_GROUPS) {
      const lineages = parseLineages(files[group]);
      expect(lineages.id).toBe(group);
      expect(lineages.nodes.length).toBeGreaterThan(1000);
    }
  });

  it('keeps every dinosaur under Dinosauria, Tyrannosaurus among the theropods', () => {
    const lineages = parseLineages(dinosaurs);
    const rex = lineages.nodes.find((node) => node.name === 'Tyrannosaurus');
    expect(rex).toBeDefined();
    const names = ancestry(lineages, rex?.index ?? 0).map((node) => node.name);
    expect(names[0]).toBe('Dinosauria');
    expect(names).toContain('Theropoda');
    expect(names.at(-1)).toBe('Tyrannosaurus');
  });
});

describe('places in time', () => {
  const lineages = parseLineages(FILE);
  const rex = lineages.nodes[3];
  if (rex === undefined) throw new Error('fixture');

  it('shows a genus where it was found in the step, never part way between steps', () => {
    // 72.5 Ma is in the step around 70 Ma, with no find: where it was last found, in Asia, not
    // half way across the Pacific to where it is found next.
    const between = sitesAt(rex.track, 72, 5);
    expect(between.found).toBe(false);
    expect(between.sites).toEqual([{ ma: 75, latitude: 50, longitude: 170, finds: 4 }]);
    // Found at two sites near 65 Ma: both, the larger first, not their middle.
    const both = sitesAt(rex.track, 66, 5);
    expect(both.found).toBe(true);
    expect(both.sites.map((site) => site.longitude)).toEqual([-79, -105]);
    // Before its first find, where it was first found.
    expect(sitesAt(rex.track, 83, 5).sites[0]?.ma).toBe(75);
  });

  it('starts a group where and when its oldest member starts', () => {
    const starts = origins(lineages);
    expect(starts[1]).toEqual(starts[2]);
    expect(starts[0]?.ma).toBe(227.3);
    expect(starts[3]?.ma).toBe(83.6);
  });

  it('knows who was living when', () => {
    expect(aliveAt(rex, 70)).toBe(true);
    expect(aliveAt(rex, 90)).toBe(false);
    expect(aliveAt(rex, 60)).toBe(false);
    expect(aliveAt(lineages.nodes[1] ?? rex, 70)).toBe(false);
  });
});

describe('fanLayout', () => {
  it('sets the genera round the circle, each group between its members', () => {
    const lineages = parseLineages(FILE);
    const fan = fanLayout(lineages, [-1, -1, -1, -1], 0.5);
    expect(fan.round).toEqual([2, 3]);
    // Two leaves span the circle less its opening, which is centred at the top.
    expect(fan.angle[2]).toBeCloseTo(-Math.PI / 2 + 0.25);
    expect(fan.angle[3]).toBeCloseTo((3 * Math.PI) / 2 - 0.25);
    expect(fan.angle[1]).toBeCloseTo(((fan.angle[2] ?? 0) + (fan.angle[3] ?? 0)) / 2);
    expect(fan.low[0]).toBe(fan.angle[2]);
    expect(fan.high[0]).toBe(fan.angle[3]);
  });

  it('leaves a gap where the colour changes, and keeps every genus in order', () => {
    const lineages = parseLineages(dinosaurs);
    const { colour } = colourGroups(lineages);
    const fan = fanLayout(lineages, colour);
    const angles = fan.round.map((genus) => fan.angle[genus] ?? 0);
    expect(angles.every((angle, at) => at === 0 || angle > (angles[at - 1] ?? 0))).toBe(true);
    expect(fan.round.length).toBe(lineages.nodes.filter((node) => node.track.length > 0).length);
    expect((angles.at(-1) ?? 0) - (angles[0] ?? 0)).toBeLessThan(2 * Math.PI);
  });
});

describe('colourGroups', () => {
  it('colours the largest members when the first split has too many', () => {
    const { heads } = colourGroups(parseLineages(mammals));
    expect(heads.length).toBeGreaterThan(1);
    expect(heads.length).toBeLessThanOrEqual(8);
  });

  it('splits from the top until it has no more than asked for', () => {
    const lineages = parseLineages(FILE);
    const { heads, colour } = colourGroups(lineages, 2);
    expect(heads).toHaveLength(2);
    expect(colour[0]).toBe(-1);
    expect(new Set([colour[2], colour[3]]).size).toBe(2);
    expect(isWithin(lineages, 3, 1)).toBe(true);
    expect(isWithin(lineages, 1, 3)).toBe(false);
  });
});
