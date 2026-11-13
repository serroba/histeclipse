import { describe, expect, it } from 'vitest';

import { parseLineages, type Lineage } from '../../data/lineages';
import { elementAt } from '../../util/arrays';
import {
  capital,
  familyOf,
  formatMa,
  generaWithin,
  momentWords,
  pickedKind,
  playStep,
  rankWord,
  span,
  tipKind,
  zoomAbout,
} from './lineagesWords';

/** Dinosauria > Theropoda > Tyrannosauridae > { Tyrannosaurus }, and Theropoda > Coelophysis. */
const lineages = parseLineages({
  schemaVersion: 2,
  credit: 'PBDB',
  source: 'https://paleobiodb.org',
  accessed: '2026-11-09',
  id: 'dinosaurs',
  name: 'Non-avian dinosaurs',
  stepMa: 5,
  ranks: ['family', 'genus', 'clade'],
  pbdb: [1, 2, 3, 4, 5],
  names: ['Dinosauria', 'Theropoda', 'Coelophysis', 'Tyrannosauridae', 'Tyrannosaurus'],
  rank: [2, 2, 1, 0, 1],
  parent: [-1, 0, 1, 1, 3],
  first: [227.3, 227.3, 227.3, 83.6, 83.6],
  last: [66, 66, 192.9, 66, 66],
  species: [0, 0, 2, 0, 2],
  // A genus is a name with finds: [step's middle Ma, latitude, longitude, finds].
  tracks: [[], [], [200, 18, -36, 2], [], [70, 45, -105, 3]],
});
const GENERA = [2, 4];
const node = (index: number): Lineage => elementAt(lineages.nodes, index);

describe('the words for time and rank', () => {
  it('says a time whole from 10 million years, else to a tenth', () => {
    expect(formatMa(227.3)).toBe('227');
    expect(formatMa(2.58)).toBe('2.6');
  });

  it('says a span, to today when it lives on', () => {
    expect(span(227.3, 66)).toBe('from 227 million years ago to 66');
    expect(span(5.3, 0)).toBe('from 5.3 million years ago to today');
  });

  it('calls a clade a group, and starts a sentence with a capital', () => {
    expect(rankWord('clade')).toBe('group');
    expect(rankWord('family')).toBe('family');
    expect(capital('group')).toBe('Group');
  });
});

describe('a name’s place in the tree', () => {
  it('finds a genus’s family, or its parent where none is a family', () => {
    expect(familyOf(lineages, 4)).toBe('Tyrannosauridae');
    expect(familyOf(lineages, 2)).toBe('Theropoda');
  });

  it('counts the genera within a group', () => {
    expect(generaWithin(lineages, GENERA, 0)).toBe(2);
    expect(generaWithin(lineages, GENERA, 3)).toBe(1);
  });

  it('says what a name is, in its tooltip and when picked', () => {
    expect(tipKind(lineages, GENERA, node(4))).toBe('Tyrannosauridae · 2 species');
    expect(tipKind(lineages, GENERA, node(1))).toBe('Group of 2 genera');
    expect(pickedKind(lineages, GENERA, node(4))).toBe('Genus, 2 species named');
    expect(pickedKind(lineages, GENERA, node(3))).toBe('Family of 1 genera here');
  });
});

describe('momentWords', () => {
  it('says the moment and the genera living, beside the slider and under the map', () => {
    expect(momentWords(66.4, 120)).toEqual({
      line: '66 million years ago · 120 genera living',
      caption:
        'The world 66 million years ago, and where the 120 genera then living were found: filled in these 5 million years, a ring where last found',
    });
    expect(momentWords(0.2, 1).line).toBe('Today · 1 genus living');
    expect(momentWords(0.2, 1).caption).toMatch(/^The world today, and where the 1 genus/);
    expect(momentWords(10, 1500).line).toBe('10 million years ago · 1,500 genera living');
  });
});

describe('playStep', () => {
  it('plays a group from its first line to its last in 24 seconds', () => {
    expect(playStep(240, 240, 0, 1)).toEqual({ at: 230, playing: true });
    expect(playStep(240, 240, 0, 12).at).toBe(120);
  });

  it('stops at the last line', () => {
    expect(playStep(5, 240, 0, 1)).toEqual({ at: -5, playing: false });
    expect(playStep(10, 240, 0, 1).playing).toBe(false);
  });
});

describe('zoomAbout', () => {
  const middle = { x: 100, y: 100 };

  it('keeps the point under the pointer where it is', () => {
    const zoomed = zoomAbout({ zoom: 1, panX: 0, panY: 0 }, 150, 100, 2, middle);
    expect(zoomed.zoom).toBe(2);
    // The point 50 px right of the middle stays at 150: drawn at 100 + 2 × 50 − 50.
    expect(zoomed.panX).toBe(-50);
    expect(zoomed.panY).toBe(0);
  });

  it('zooms between 1 and 40, centred again at 1', () => {
    expect(zoomAbout({ zoom: 30, panX: 0, panY: 0 }, 100, 100, 2, middle).zoom).toBe(40);
    expect(zoomAbout({ zoom: 2, panX: 30, panY: -20 }, 0, 0, 0.1, middle)).toEqual({
      zoom: 1,
      panX: 0,
      panY: 0,
    });
  });
});
