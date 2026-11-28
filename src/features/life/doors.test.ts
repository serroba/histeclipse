import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseLife } from '../../data/lifeStories';
import { doorRows, openAt, wayTo, withDoors, type DoorRow } from './doors';
import { APART, LAND, loadLifeDoors, SHELF, type LifeDoors } from './lifeDoors';
import { storyOf, type Story } from './story';

const mammals = parseLife(
  JSON.parse(readFileSync('public/data/life-stories/mammals.json', 'utf8')),
);
const served: Promise<LifeDoors> = loadLifeDoors('doors.json', () =>
  Promise.resolve(new Response(readFileSync('public/data/life-stories/doors.json', 'utf8'))),
);

function story(name: string): Story {
  const node = mammals.nodes.find((each) => each.name === name);
  const told = storyOf(mammals, node?.pbdb ?? -1, null);
  if (told === null) throw new Error(`no story for ${name}`);
  return told;
}

/** Three lands in a row: A and B joined by land, B and C by a shelf, at the one step. */
const row: LifeDoors = {
  schemaVersion: 1,
  sources: ['paleodem'],
  credit: 'made for the test',
  licence: 'CC BY 4.0',
  changes: 'made for the test',
  source: 'https://example.org',
  accessed: '2026-11-28',
  stepMa: 5,
  lands: ['A', 'B', 'C', 'D'],
  steps: [0],
  shelfMetres: 130,
  doors: [
    { a: 0, b: 1, states: [LAND] },
    { a: 1, b: 2, states: [SHELF] },
  ],
};

describe('the way between two lands', () => {
  it('is by land where doors of land lead there, through the lands between', () => {
    expect(wayTo(row, 0, new Set([0]), 1)).toEqual({ state: LAND, through: ['A', 'B'] });
    expect(wayTo(row, 0, new Set([1]), 0)).toEqual({ state: LAND, through: ['B', 'A'] });
  });

  it('is by a shallow sea where only a shelf leads there', () => {
    expect(wayTo(row, 0, new Set([0]), 2)).toEqual({ state: SHELF, through: ['A', 'B', 'C'] });
  });

  it('is none where no door leads there, or beyond the steps the doors are read at', () => {
    expect(wayTo(row, 0, new Set([0]), 3)).toEqual({ state: APART, through: [] });
    expect(wayTo(row, 500, new Set([0]), 1).state).toBe(APART);
  });

  it('starts from the nearest of the lands already reached', () => {
    expect(wayTo(row, 0, new Set([0, 1]), 2).through).toEqual(['B', 'C']);
  });

  it('has Panama shut 15 million years ago and open 5 million years ago, on the maps', async () => {
    const doors = await served;
    const [north, south] = [
      doors.lands.indexOf('North America'),
      doors.lands.indexOf('South America'),
    ];
    expect(wayTo(doors, 15, new Set([north]), south).state).toBe(APART);
    expect(wayTo(doors, 5, new Set([north]), south)).toEqual({
      state: LAND,
      through: ['North America', 'South America'],
    });
  });
});

describe('the doors in an animal’s story', () => {
  it('say of each new continent whether land joined it to one already reached', async () => {
    const told = withDoors(story('Felidae'), await served);
    const south = told.chapters.find((chapter) => chapter.title === 'First found in South America');
    expect(south?.text).toContain(' Land joined it to North America then.');
    const firsts = told.chapters.filter((chapter) => chapter.title.startsWith('First found in'));
    expect(firsts.length).toBeGreaterThan(2);
    for (const chapter of firsts) {
      expect(chapter.text).toMatch(/Land joined it|shallow sea|sea lay between/);
    }
  });

  it('name the lands walked through, and leave the other moments as they were', async () => {
    const before = story('Proboscidea');
    const told = withDoors(before, await served);
    const america = told.chapters.find(
      (chapter) => chapter.title === 'First found in North America',
    );
    expect(america?.text).toMatch(
      /Land joined it to (Asia|Europe|Africa) .*by way of|Land joined it to Asia/,
    );
    expect(told.chapters[0]).toBe(before.chapters[0]);
    expect(told.chapters).toHaveLength(before.chapters.length);
  });

  it('say a shallow sea, a way open only the step before, and a crossing of water', () => {
    const cats = story('Felidae');
    const firsts = cats.chapters.filter((chapter) => chapter.title.startsWith('First found in'));
    const said = (doors: LifeDoors): string =>
      withDoors(cats, doors).chapters.find((chapter) => chapter.title === firsts[0]?.title)?.text ??
      '';
    const [reached, fresh] = [4, 2];
    const lands = mammals.regions;
    const steps = cats.steps.map((step) => step.ma).reverse();
    const at = (ma: number, state: 0 | 1 | 2): (0 | 1 | 2)[] =>
      steps.map((step) => (step === ma ? state : APART));
    const made = (states: (0 | 1 | 2)[]): LifeDoors => ({
      ...row,
      lands: [...lands],
      steps,
      doors: [{ a: fresh, b: reached, states }],
    });
    const when = firsts[0]?.ma ?? 0;
    expect(said(made(at(when, SHELF)))).toContain(
      'Only shallow sea (under about 130 m) lay between it and Asia then.',
    );
    expect(said(made(at(when + 5, LAND)))).toContain(
      'Land joined it to Asia in the 5 million years before.',
    );
    expect(said(made(at(when, APART)))).toContain('a crossing of water');
  });

  it('chart the doors between the lands the story has finds on, and no others', async () => {
    const doors = await served;
    const rows = doorRows(story('Proboscidea'), doors);
    expect(rows.map((each) => each.name)).toContain('North America – Asia');
    expect(rows.some((each) => each.name.includes('Antarctica'))).toBe(false);
    for (const each of rows) expect(each.states.some((state) => state !== APART)).toBe(true);
  });

  it('say which charted doors are open at a step, by land and by shallow sea', () => {
    const [first, second] = row.doors;
    if (first === undefined || second === undefined) throw new Error('two doors');
    const rows: DoorRow[] = [
      { door: first, name: 'A – B', states: [LAND, APART] },
      { door: second, name: 'B – C', states: [SHELF, APART] },
    ];
    expect(openAt(rows, 0)).toEqual({ land: ['A – B'], shelf: ['B – C'] });
    expect(openAt(rows, 1)).toEqual({ land: [], shelf: [] });
  });
});
