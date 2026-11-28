import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseLife, type LifeData } from '../../data/lifeStories';
import type { Chapter } from './chapters';
import { storyOf } from './story';

function served(id: string): LifeData {
  return parseLife(JSON.parse(readFileSync(`public/data/life-stories/${id}.json`, 'utf8')));
}

const mammals = served('mammals');
const dinosaurs = served('dinosaurs');

function chapters(data: LifeData, name: string, focus: string | null = null): readonly Chapter[] {
  const numbered = (wanted: string | null): number | null =>
    data.nodes.find((node) => node.name === wanted)?.pbdb ?? null;
  return storyOf(data, numbered(name) ?? -1, numbered(focus))?.chapters ?? [];
}

function titled(all: readonly Chapter[], title: string): Chapter | undefined {
  return all.find((chapter) => chapter.title === title);
}

describe('the moments of an animal’s story', () => {
  it('come oldest first, opening on the oldest finds and where they lay', () => {
    const elephants = chapters(mammals, 'Proboscidea');
    const moments = elephants.map((chapter) => chapter.ma);
    expect(moments).toEqual([...moments].sort((a, b) => b - a));
    const [first] = elephants;
    expect(first?.title).toBe('The oldest finds');
    expect(first?.text).toContain('60 million years ago: Eritherium, in Africa.');
    expect(first?.text).toContain('Where they lay it was about 26 °C; the globe averaged 22 °C.');
    expect(first?.where).not.toBeNull();
  });

  it('say each part of the world the first time it has finds, and how long after the oldest', () => {
    const elephants = chapters(mammals, 'Proboscidea');
    expect(
      elephants
        .filter((chapter) => chapter.title.startsWith('First found in'))
        .map((chapter) => chapter.title),
    ).toEqual([
      'First found in Asia',
      'First found in Europe',
      'First found in North America',
      'First found in South America',
    ]);
    expect(titled(elephants, 'First found in Asia')?.text).toContain(
      '30 million years ago, 30 million years after the oldest finds.',
    );
  });

  it('name several parts of the world reached in one step together', () => {
    const whales = chapters(mammals, 'Cetacea');
    expect(
      titled(whales, 'First found in North America, South America, Europe and Africa'),
    ).toBeDefined();
  });

  it('say where the lineage kept to the warmth as the globe cooled, or lived in its cold', () => {
    const primates = titled(chapters(mammals, 'Primates'), 'Keeping to the warmth');
    expect(primates?.text).toBe(
      '30 million years ago the globe averaged 18 °C; where the primate finds lay it was about 26 °C.',
    );
    expect(titled(chapters(dinosaurs, 'Tyrannosauridae'), 'Living in the cold')).toBeDefined();
  });

  it('leave the warmth unsaid where it was never far from the globe’s', () => {
    const titles = chapters(mammals, 'Equus').map((chapter) => chapter.title);
    expect(titles).not.toContain('Living in the cold');
  });

  it('say the most kinds at once and the most endings, where there are several', () => {
    const horses = chapters(mammals, 'Equidae');
    expect(titled(horses, 'The most kinds at once')?.text).toContain('22 kinds known');
    expect(titled(horses, 'The most endings')?.text).toMatch(/the last finds of \d+ kinds/);
    // A single kind has neither.
    const one = chapters(mammals, 'Eohippus').map((chapter) => chapter.title);
    expect(one).not.toContain('The most kinds at once');
    expect(one).not.toContain('The most endings');
  });

  it('say the picked kind’s own oldest finds, unless they are the story’s', () => {
    const cats = chapters(mammals, 'Felidae', 'Panthera');
    expect(titled(cats, 'The oldest Panthera finds')?.text).toContain(
      '10 million years ago, in Asia.',
    );
    const first = chapters(mammals, 'Felidae', 'Proailurus').map((chapter) => chapter.title);
    expect(first).not.toContain('The oldest Proailurus finds');
  });

  it('close on today while a kind lives: how many, and which', () => {
    const horses = chapters(mammals, 'Equidae').at(-1);
    expect(horses?.title).toBe('Today');
    expect(horses?.ma).toBe(0);
    expect(horses?.text).toBe('1 of its 44 kinds found as fossils is living: Equus.');
    expect(chapters(mammals, 'Camelidae').at(-1)?.text).toContain(
      'kinds found as fossils are living',
    );
  });

  it('close on the last finds when no kind lives', () => {
    const tyrants = chapters(dinosaurs, 'Tyrannosauridae').at(-1);
    expect(tyrants?.title).toBe('The last finds');
    expect(tyrants?.text).toContain('None of its 17 kinds is living.');
  });

  it('say the last 2.5 million years in words, not as zero', () => {
    const primates = chapters(mammals, 'Primates');
    expect(titled(primates, 'First found in Oceania')?.text).toContain(
      'In the last 2.5 million years, 65 million years after the oldest finds.',
    );
  });
});
