// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { parseLife, type LifeData } from '../../data/lifeStories';
import { doorRows, type DoorRow } from './doors';
import { loadLifeDoors } from './lifeDoors';
import { loadLifePictures, type Silhouette } from './lifePictures';
import {
  branchChips,
  button,
  chapterList,
  headingOf,
  noteOf,
  nowBox,
  nowText,
  trailOf,
} from './panelParts';
import { storyOf, type Story, type StoryStep } from './story';

const FOLDER = join(import.meta.dirname, '../../../public/data/life-stories');
const text = (name: string): string => readFileSync(join(FOLDER, `${name}.json`), 'utf8');
const served = (name: string) => () => Promise.resolve(new Response(text(name)));
const mammals = parseLife(JSON.parse(text('mammals')));
const dinosaurs = parseLife(JSON.parse(text('dinosaurs')));
const doors = await loadLifeDoors('doors.json', served('doors'));
const pictures = await loadLifePictures('pictures.json', served('pictures'));

const pbdbOf = (data: LifeData, name: string): number =>
  data.nodes.find((node) => node.name === name)?.pbdb ?? -1;

function told(data: LifeData, clade: string, focus: string | null = null): Story {
  const story = storyOf(data, pbdbOf(data, clade), focus === null ? null : pbdbOf(data, focus));
  if (story === null) throw new Error(`no story of ${clade}`);
  return story;
}

const cats = told(mammals, 'Felidae');
const lion = told(mammals, 'Felidae', 'Panthera');
const panthera = told(mammals, 'Panthera');
const tyrannosaurs = told(dinosaurs, 'Tyrannosauridae');

const texts = (nodes: readonly (Node | string)[]): string =>
  nodes.map((node) => (typeof node === 'string' ? node : node.textContent)).join('');

function inPage(nodes: readonly (Node | string)[]): HTMLElement {
  const page = document.createElement('div');
  page.append(...nodes);
  return page;
}

const step = (over: Partial<StoryStep>): StoryStep => ({
  ma: 10,
  finds: 12,
  byRegion: [4, 0, 8, 0, 0, 0, 0],
  kinds: 3,
  began: [],
  ended: [],
  celsius: 21.4,
  globe: 15.6,
  ...over,
});

describe('a button of the story', () => {
  it('has its class and label, and runs what it is given when pressed', () => {
    const run = vi.fn();
    const made = button('life-play', 'Play its story', run);
    expect(made.type).toBe('button');
    expect(made.className).toBe('life-play');
    expect(made.textContent).toBe('Play its story');
    made.click();
    expect(run).toHaveBeenCalledOnce();
  });
});

describe('whose story it is', () => {
  it('names a lineage by its everyday name, and counts its kinds found and living', () => {
    expect(headingOf(cats)).toEqual({
      title: 'Cats',
      subtitle: 'Felidae · 42 kinds found as fossils, 10 living',
    });
  });

  it('names a picked kind by its best-known animal, and says which others share the genus', () => {
    expect(headingOf(lion)).toEqual({
      title: 'Lion',
      subtitle:
        'Panthera, the genus of the lion, tiger, leopard and jaguar: one of 42 kinds of cat (Felidae) found as fossils, 10 of them living',
    });
  });

  it('names a picked kind with no everyday name by its own', () => {
    expect(headingOf(told(mammals, 'Felidae', 'Metailurus'))).toEqual({
      title: 'Metailurus',
      subtitle: 'Metailurus: one of 42 kinds of cat (Felidae) found as fossils, 10 of them living',
    });
  });

  it('names a lineage with no everyday name by its common name, else its own', () => {
    expect(headingOf(told(mammals, 'Felinae')).title).toBe('Felinae');
    expect(headingOf(told(dinosaurs, 'Tyrannosaurinae')).title).toBe('Tyrannosaurine');
    expect(headingOf(told(mammals, 'Carnivora')).title).toBe('Carnivoran');
  });
});

describe('the trail of a story’s ancestors', () => {
  it('names the ranked ancestors from the group down, the story’s own last and marked', () => {
    const page = inPage(trailOf(cats, vi.fn()));
    expect(page.textContent).toBe('Zoom out: mammal › carnivoran › Feliformia › Feloidea › cat');
    const crumbs = [...page.querySelectorAll('button')];
    expect(crumbs.map((crumb) => crumb.title)).toEqual([
      'Mammalia (class)',
      'Carnivora (order)',
      'Feliformia (suborder)',
      'Feloidea (superfamily)',
      'Felidae (family)',
    ]);
    expect(crumbs.map((crumb) => crumb.className)).toEqual([
      'life-crumb',
      'life-crumb',
      'life-crumb',
      'life-crumb',
      'life-crumb is-here',
    ]);
    expect(crumbs.map((crumb) => crumb.getAttribute('aria-current'))).toEqual([
      null,
      null,
      null,
      null,
      'true',
    ]);
  });

  it('keeps the story’s own lineage last whatever its rank', () => {
    const page = inPage(trailOf(panthera, vi.fn()));
    expect(page.textContent).toBe(
      'Zoom out: mammal › carnivoran › Feliformia › Feloidea › cat › Felinae › Panthera',
    );
    expect(page.querySelector('.is-here')?.getAttribute('title')).toBe('Panthera (genus)');
  });

  it('opens the wider story of the ancestor pressed', () => {
    const open = vi.fn();
    const page = inPage(trailOf(cats, open));
    page.querySelectorAll('button')[1]?.click();
    expect(open).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ name: 'Carnivora', pbdb: pbdbOf(mammals, 'Carnivora') }),
    );
  });
});

describe('a story’s moments', () => {
  it('lists each with its title and text, kept by its moment', () => {
    const items = chapterList(cats, vi.fn());
    expect(items).toHaveLength(cats.chapters.length);
    expect(items.map((item) => item.getAttribute('data-ma'))).toEqual(
      cats.chapters.map((chapter) => String(chapter.ma)),
    );
    const [first] = items;
    expect(first?.tagName).toBe('LI');
    expect(first?.querySelector('.life-chapter-title')?.textContent).toBe('The oldest finds');
    expect(first?.querySelector('.life-chapter-text')?.textContent).toBe(cats.chapters[0]?.text);
  });

  it('goes to a moment’s time and place when it is pressed', () => {
    const goTo = vi.fn();
    const items = chapterList(cats, goTo);
    items[1]?.querySelector('button')?.click();
    expect(goTo).toHaveBeenCalledExactlyOnceWith(25, cats.chapters[1]?.where);
    expect(cats.chapters[1]?.where).not.toBeNull();
  });
});

describe('the lineages within a story’s', () => {
  it('offers each with how many kinds were found in it, the most first, and opens it', () => {
    const open = vi.fn();
    const shown: Silhouette[] = [];
    const chips = branchChips(cats, null, open, shown);
    expect(chips).toHaveLength(10);
    const [first, second] = chips;
    expect(first?.className).toBe('life-branch');
    expect(first?.title).toBe('Machairodontinae (subfamily): 18 kinds found');
    expect(first?.querySelector('.life-count')?.textContent).toBe('18');
    expect(second?.title).toBe('Felinae (subfamily): 15 kinds found');
    // Before the pictures have loaded: names alone.
    expect(first?.querySelector('img')).toBeNull();
    expect(shown).toEqual([]);
    second?.click();
    expect(open).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: 'Felinae' }));
  });

  it('shows the silhouette of each that has one, and keeps them for the credits', () => {
    const shown: Silhouette[] = [];
    const chips = branchChips(cats, pictures, vi.fn(), shown);
    const drawn = chips.filter((chip) => chip.querySelector('img.life-silhouette') !== null);
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.length).toBeLessThan(chips.length);
    expect(shown).toHaveLength(drawn.length);
    expect(drawn[0]?.querySelector('img')?.getAttribute('width')).toBe('20');
    expect(chips[0]?.querySelector('span')?.textContent).toMatch(/^[A-Z]/);
  });

  it('says a single kind has none further in', () => {
    const chips = branchChips(panthera, pictures, vi.fn(), []);
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'No lineages further in: this is a single kind.',
    ]);
    expect(chips[0]?.className).toBe('life-note');
  });
});

describe('what a step holds, in words', () => {
  it('says how many kinds were known, where they were found, and how warm it was', () => {
    expect(nowText(cats, step({}), 10)).toBe(
      '3 kinds known, found in North America and Europe. About 21 °C where they lay; the globe averaged 16 °C.',
    );
    expect(nowText(cats, step({ kinds: 1, byRegion: [0, 0, 0, 0, 2] }), 10)).toBe(
      '1 kind known, found in Asia. About 21 °C where they lay; the globe averaged 16 °C.',
    );
  });

  it('leaves the climate out where either temperature is unknown', () => {
    expect(nowText(cats, step({ celsius: null }), 10)).toBe(
      '3 kinds known, found in North America and Europe.',
    );
    expect(nowText(cats, step({ globe: null }), 10)).toBe(
      '3 kinds known, found in North America and Europe.',
    );
    // A step counting fewer regions than the file names: the rest have no finds.
    expect(nowText(cats, step({ globe: null, byRegion: [1] }), 10)).toBe(
      '3 kinds known, found in North America.',
    );
  });

  it('calls a step with no finds a gap in the record, not an absence', () => {
    expect(nowText(cats, step({ finds: 0, kinds: 5 }), 10)).toBe(
      'No finds in this step: a gap in the record. 5 kinds known from before and after.',
    );
  });

  it('says a moment outside the story is before its oldest finds or after its last', () => {
    expect(nowText(cats, undefined, 60)).toBe('Before the oldest finds, 30 million years ago.');
    expect(nowText(tyrannosaurs, undefined, 20)).toBe('After its last finds.');
    expect(nowText({ ...cats, steps: [] }, undefined, 0)).toBe('After its last finds.');
  });
});

describe('what the moment shown holds', () => {
  it('says when, what was known, and names up to six of the kinds first and last found', () => {
    const shown: Silhouette[] = [];
    const page = inPage(nowBox(cats, 5, 4.2, { pictures, doors: [], shown }));
    expect(page.querySelector('.life-when')?.textContent).toBe('5 million years ago');
    expect(page.children[1]?.textContent).toMatch(/^30 kinds known, found in North America, /);
    expect(page.querySelector('.life-doors-now')).toBeNull();
    const began = page.querySelector('.life-change.is-began');
    expect(began?.querySelector('strong')?.textContent).toBe('First found: ');
    expect(began?.querySelectorAll('.life-kind')).toHaveLength(6);
    expect(began?.textContent).toMatch(/ and 9 more$/);
    const ended = page.querySelector('.life-change.is-ended');
    expect(ended?.querySelector('strong')?.textContent).toBe('Last found: ');
    expect(ended?.querySelectorAll('.life-kind')).toHaveLength(6);
    expect(ended?.textContent).toMatch(/ and 8 more$/);
    // The kinds named with a silhouette are kept for the credits.
    expect(shown).toHaveLength(page.querySelectorAll('img.life-silhouette').length);
    expect(shown.length).toBeGreaterThan(0);
  });

  it('calls the last step the last 2.5 million years, and names a few kinds without “more”', () => {
    const page = inPage(nowBox(cats, 0, 0, { pictures: null, doors: [], shown: [] }));
    expect(page.querySelector('.life-when')?.textContent).toBe('The last 2.5 million years');
    const began = page.querySelector('.life-change.is-began');
    expect(began?.querySelectorAll('.life-kind')).toHaveLength(3);
    expect(began?.textContent).not.toContain('more');
  });

  it('leaves out the kinds first and last found where a step has none', () => {
    const page = inPage(nowBox(cats, 25, 25, { pictures, doors: [], shown: [] }));
    expect(page.querySelector('.life-change')).toBeNull();
    expect(page.children).toHaveLength(2);
  });

  it('says which doors were joined by land and which had a shallow sea between', () => {
    const rows = doorRows(cats, doors);
    const at = (ma: number): string | null | undefined =>
      inPage(nowBox(cats, ma, ma, { pictures, doors: rows, shown: [] })).querySelector(
        '.life-doors-now',
      )?.textContent;
    expect(at(5)).toBe(
      'Doors: joined by land: North America – South America; North America – Asia; Europe – Asia; Africa – Asia. a shallow sea between: Europe – Africa.',
    );
    expect(at(30)).toBe(
      'Doors: joined by land: North America – Asia; Europe – Africa; Europe – Asia; Africa – Asia.',
    );
  });

  it('says so where sea lay between all its lands, or only shallow seas', () => {
    const [door] = doors.doors;
    if (door === undefined) throw new Error('no doors');
    const row: DoorRow = { door, name: 'Europe – Africa', states: [0, 1, 0, 0, 0, 0, 0] };
    const at = (ma: number): string | null | undefined =>
      inPage(nowBox(cats, ma, ma, { pictures, doors: [row], shown: [] })).querySelector(
        '.life-doors-now',
      )?.textContent;
    expect(at(30)).toBe('Doors: sea between all the lands it was found on.');
    expect(at(25)).toBe('Doors: a shallow sea between: Europe – Africa.');
  });

  it('says nothing of doors or kinds at a moment outside the story', () => {
    const page = inPage(
      nowBox(cats, 60, 61, { pictures, doors: doorRows(cats, doors), shown: [] }),
    );
    expect(texts([...page.children])).toBe(
      '60 million years agoBefore the oldest finds, 30 million years ago.',
    );
  });
});

describe('the note under a story', () => {
  it('says what the story is made of and cannot say, and credits the finds’ source', () => {
    const note = inPage(noteOf(cats));
    expect(note.textContent).toMatch(/^Each dot is a place fossils were found, where it lay then/);
    expect(note.textContent).toContain('A kind is a genus.');
    expect(note.textContent).toContain(`(CC BY 4.0), read ${mammals.accessed}.`);
    const link = note.querySelector('a');
    expect(link?.textContent).toBe('the Paleobiology Database');
    expect(link?.getAttribute('href')).toBe(mammals.source);
    expect(link?.getAttribute('rel')).toBe('noopener');
  });
});
