import fc from 'fast-check';
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
  origins,
  parseLineages,
  strokes,
  strokeUntil,
  trackAt,
  type Vertex,
} from './lineages';

/** Dinosauria > Theropoda > { Tyrannosaurus (83.6–66, drifting), Coelophysis (227–193) }. */
const FILE = {
  schemaVersion: 1,
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
  tracks: [[], [], [195, 24, -18, 1, 200, 18, -36, 2], [65, 52, -79, 80, 75, 50, 170, 4]],
};

describe('parseLineages', () => {
  it('reads nodes with their children and tracks, oldest point first', () => {
    const lineages = parseLineages(FILE);
    const [root, theropods, coelophysis] = lineages.nodes;
    expect(root?.children).toEqual([1]);
    expect(theropods?.children).toEqual([2, 3]);
    // Each point at the middle of its step, oldest first, within the genus's span.
    expect(coelophysis?.track.map((point) => point.ma)).toEqual([202.5, 197.5]);
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

  it('follows a track between steps the short way round the antimeridian', () => {
    // 77.5 Ma at 170°E, 67.5 Ma at 79°W: half way is across the antimeridian, not over Africa.
    const half = trackAt(rex.track, 72.5);
    expect(half.latitude).toBeCloseTo(51);
    expect(Math.abs(half.longitude)).toBeGreaterThan(90);
    expect(trackAt(rex.track, 83)).toEqual({ latitude: 50, longitude: 170 });
    expect(trackAt(rex.track, 66)).toEqual({ latitude: 52, longitude: -79 });
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

  it('draws each genus through its steps, and a branch to each member from its group', () => {
    const drawn = strokes(lineages, origins(lineages));
    const own = drawn.find((stroke) => stroke.node === 3 && !stroke.branch);
    expect(own?.vertices.map((vertex) => vertex.ma)).toEqual([83.6, 80, 75, 70, 66]);
    expect(drawn.some((stroke) => stroke.node === 3 && stroke.branch)).toBe(true);
    // Theropoda starts with Coelophysis: no branch of zero length.
    expect(drawn.some((stroke) => stroke.node === 2 && stroke.branch)).toBe(false);
  });

  it('cuts a stroke at a moment, keeping only what had happened', () => {
    const line: Vertex[] = [
      { ma: 100, latitude: 0, longitude: 0 },
      { ma: 90, latitude: 10, longitude: 10 },
      { ma: 80, latitude: 20, longitude: 20 },
    ];
    expect(strokeUntil(line, 110)).toEqual([]);
    expect(strokeUntil(line, 70)).toEqual(line);
    expect(strokeUntil(line, 85)).toEqual([
      line[0],
      line[1],
      { ma: 85, latitude: 15, longitude: 15 },
    ]);
  });

  it('a cut never reaches later than the moment', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 120, noNaN: true }), (ma) => {
        const line: Vertex[] = [
          { ma: 100, latitude: 0, longitude: 0 },
          { ma: 50, latitude: 10, longitude: 170 },
          { ma: 10, latitude: 20, longitude: -170 },
        ];
        return strokeUntil(line, ma).every(
          (vertex) => vertex.ma >= ma - 1e-9 && vertex.longitude >= -180 && vertex.longitude < 180,
        );
      }),
    );
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
