// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseLife, type LifeData, type LifeNode } from '../../data/lifeStories';
import { createLifeFinder, described } from './finder';
import { loadLifePictures, type LifePictures } from './lifePictures';
import type { Found } from './names';

const FOLDER = join(import.meta.dirname, '../../../public/data/life-stories');
const text = (name: string): string => readFileSync(join(FOLDER, `${name}.json`), 'utf8');
const mammals = parseLife(JSON.parse(text('mammals')));
const dinosaurs = parseLife(JSON.parse(text('dinosaurs')));
const pictures = await loadLifePictures('pictures.json', () =>
  Promise.resolve(new Response(text('pictures'))),
);

function named(data: LifeData, name: string): LifeNode {
  const node = data.nodes.find((each) => each.name === name);
  if (node === undefined) throw new Error(`no ${name}`);
  return node;
}

/** Let a load's promise, and what waits on it, settle. */
const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function opened(
  load: () => Promise<readonly LifeData[]> = () => Promise.resolve([mammals, dinosaurs]),
  seen: () => LifePictures | null = () => pictures,
) {
  const asked = vi.fn(load);
  const onPick = vi.fn<(found: Found, data: LifeData) => void>();
  const finder = createLifeFinder(asked, onPick, seen);
  document.body.append(finder.button, finder.dialog);
  const { dialog } = finder;
  const input = dialog.querySelector('input') ?? document.createElement('input');
  const status = (): string | null | undefined =>
    dialog.querySelector('[role="status"]')?.textContent;
  const titles = (): (string | null)[] =>
    [...dialog.querySelectorAll('.famous-title')].map((each) => each.textContent);
  const type = (query: string): void => {
    input.value = query;
    input.dispatchEvent(new Event('input'));
  };
  return { finder, dialog, input, asked, onPick, status, titles, type };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('what a found animal is, under its name', () => {
  const found = (data: LifeData, name: string, known = ''): Found => ({
    group: data.id,
    node: named(data, name),
    known,
  });

  it('is a kind in its lineage, living or extinct, with its own name when found by another', () => {
    expect(described(found(mammals, 'Panthera', 'lion'), mammals)).toBe(
      'Panthera, a kind (genus) · in Felinae · living',
    );
    expect(described(found(mammals, 'Panthera'), mammals)).toBe(
      'a kind (genus) · in Felinae · living',
    );
    expect(described(found(dinosaurs, 'Tyrannosaurus', 't. rex'), dinosaurs)).toBe(
      'Tyrannosaurus, a kind (genus) · in Tyrannosaurini · extinct',
    );
  });

  it('is a lineage by its rank, living if it is, and of the whole group at its root', () => {
    expect(described(found(mammals, 'Felidae', 'cats'), mammals)).toBe(
      'Felidae, a lineage (family) · in Feloidea · living',
    );
    expect(described(found(dinosaurs, 'Tyrannosauridae'), dinosaurs)).toBe(
      'a lineage (family) · in Tyrannosauroidea',
    );
    expect(described(found(mammals, 'Mammalia'), mammals)).toBe(
      'a lineage (class) · Mammals · living',
    );
  });
});

describe('finding an animal', () => {
  it('opens from its button, loads the groups once, and offers well-known animals meanwhile', async () => {
    const { finder, dialog, input, asked, status, titles } = opened();
    expect(finder.button.getAttribute('aria-label')).toBe('Find an animal and follow its story');
    expect(dialog.open).toBe(false);
    finder.button.click();
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(status()).toBe('Loading…');
    expect(titles()).toEqual([]);
    // Opened again while it loads: not asked for twice.
    finder.open();
    expect(asked).toHaveBeenCalledOnce();
    await settled();
    expect(status()).toMatch(/^Follow an animal’s line back through the fossil record/);
    expect(titles()).toEqual([
      'lion',
      'horse',
      'elephant',
      'whale',
      'kangaroo',
      'mammoth',
      'camel',
      'human',
      'Tyrannosaurus',
      'Triceratops',
    ]);
    finder.open();
    expect(asked).toHaveBeenCalledOnce();
  });

  it('lists what the words typed find, each with its silhouette or its group’s colour', async () => {
    const { finder, dialog, status, titles, type } = opened();
    finder.open();
    await settled();
    type('  lion ');
    expect(titles()[0]).toBe('lion');
    expect(status()).toBe(`${String(titles().length)} found`);
    const [first] = [...dialog.querySelectorAll('.famous-item')];
    expect(first?.querySelector('.famous-meta')?.textContent).toBe(
      'Panthera, a kind (genus) · in Felinae · living',
    );
    expect(first?.querySelector('img.life-silhouette')?.getAttribute('width')).toBe('28');
    // Some of what "lion" finds has no silhouette: its group's colour stands in.
    expect(dialog.querySelector('.fossil-key.is-mammals')).not.toBeNull();
    type('Tyrannosaurus');
    expect(titles()[0]).toBe('Tyrannosaurus');
  });

  it('draws every animal with its group’s colour before the pictures have loaded', async () => {
    const { finder, dialog, titles } = opened(undefined, () => null);
    finder.open();
    await settled();
    expect(dialog.querySelectorAll('img')).toHaveLength(0);
    expect(dialog.querySelectorAll('.fossil-key')).toHaveLength(titles().length);
    expect(dialog.querySelectorAll('.fossil-key.is-dinosaurs')).toHaveLength(2);
  });

  it('says so when nothing answers, and what is not in yet', async () => {
    const { finder, status, titles, type } = opened();
    finder.open();
    await settled();
    type('zzzzzz');
    expect(status()).toBe(
      'No such animal among the fossil mammals and dinosaurs. Birds, reptiles and fish are not in yet.',
    );
    expect(titles()).toEqual([]);
    type('');
    expect(titles()).toHaveLength(10);
  });

  it('closes and hands on the animal picked, with its group’s file', async () => {
    const { finder, dialog, onPick, type } = opened();
    finder.open();
    await settled();
    type('t. rex');
    dialog.querySelector<HTMLButtonElement>('.famous-item')?.click();
    expect(dialog.open).toBe(false);
    expect(onPick).toHaveBeenCalledExactlyOnceWith(
      { group: 'dinosaurs', node: named(dinosaurs, 'Tyrannosaurus'), known: 't. rex' },
      dinosaurs,
    );
  });

  it('closes by its close button or a tap outside it, not by a tap inside', async () => {
    const { finder, dialog } = opened();
    finder.open();
    await settled();
    dialog.querySelector('h2')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.open).toBe(true);
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.open).toBe(false);
    finder.open();
    expect(dialog.open).toBe(true);
    dialog.querySelector<HTMLButtonElement>('.famous-close')?.click();
    expect(dialog.open).toBe(false);
  });

  it('says the animals could not load, and asks again the next time it opens', async () => {
    const load = vi
      .fn<() => Promise<readonly LifeData[]>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue([mammals]);
    const { finder, dialog, asked, status, titles, type } = opened(load);
    finder.open();
    await settled();
    expect(status()).toBe('Could not load the animals. Try again later.');
    type('lion');
    expect(status()).toBe('Could not load the animals. Try again later.');
    expect(titles()).toEqual([]);
    dialog.close();
    finder.open();
    expect(status()).toBe('Loading…');
    await settled();
    expect(asked).toHaveBeenCalledTimes(2);
    expect(titles()[0]).toBe('lion');
  });
});
