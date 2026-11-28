import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseLife, type LifeData } from '../../data/lifeStories';
import { everydayNames, findAnimals, storyFor } from './names';
import { marksAt, storyOf } from './story';

function group(id: string): LifeData {
  return parseLife(JSON.parse(readFileSync(`public/data/life-stories/${id}.json`, 'utf8')));
}

const mammals = group('mammals');
const dinosaurs = group('dinosaurs');

describe('an animal’s story', () => {
  it('finds the lion under its genus, and tells the cats’ story with it picked out', () => {
    const [found] = findAnimals([mammals, dinosaurs], 'lion');
    expect(found?.node.name).toBe('Panthera');
    expect(everydayNames('mammals', 'Panthera')).toContain('tiger');
    const { pbdb, focus } = storyFor(mammals, found?.node ?? mammals.nodes[0]!);
    const story = storyOf(mammals, pbdb, focus);
    expect(story?.clade.name).toBe('Felidae');
    expect(story?.focus?.name).toBe('Panthera');
  });

  it('tells the elephants’ story from Africa outward, oldest moment first', () => {
    const order = mammals.nodes.find((node) => node.name === 'Proboscidea');
    const story = storyOf(mammals, order?.pbdb ?? -1, null);
    const [first, ...rest] = story?.chapters ?? [];
    expect(first?.text).toContain('in Africa');
    const reached = rest.filter((chapter) => chapter.title.startsWith('First found in'));
    expect(reached.map((chapter) => chapter.title)).toEqual([
      'First found in Asia',
      'First found in Europe',
      'First found in North America',
      'First found in South America',
    ]);
    const moments = (story?.chapters ?? []).map((chapter) => chapter.ma);
    expect(moments).toEqual([...moments].sort((a, b) => b - a));
  });

  it('ends a lineage with no living kind at its last finds, and marks where each was last seen', () => {
    const [found] = findAnimals([mammals, dinosaurs], 't. rex');
    expect(found?.node.name).toBe('Tyrannosaurus');
    const { pbdb, focus } = storyFor(dinosaurs, found?.node ?? dinosaurs.nodes[0]!);
    const story = storyOf(dinosaurs, pbdb, focus);
    expect(story?.living).toBe(0);
    expect(story?.chapters.at(-1)?.title).toBe('The last finds');
    const last = story?.steps.at(-1)?.ma ?? 0;
    const after = story === null || story === undefined ? [] : marksAt(story, last - 5);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((mark) => mark.kind === 'ended')).toBe(true);
  });

  it('counts each step’s kinds, finds and regions consistently', () => {
    const family = mammals.nodes.find((node) => node.name === 'Equidae');
    const story = storyOf(mammals, family?.pbdb ?? -1, null);
    for (const step of story?.steps ?? []) {
      expect(step.byRegion.reduce((sum, count) => sum + count, 0)).toBe(step.finds);
      expect(step.kinds).toBeGreaterThanOrEqual(step.began.length);
    }
    // Horses: after a first reach into Europe and Asia, North America alone for 20 million years.
    const early = (story?.steps ?? []).filter((step) => step.ma <= 45 && step.ma >= 25);
    expect(early).toHaveLength(5);
    expect(early.every((step) => step.finds === (step.byRegion[0] ?? 0))).toBe(true);
  });

  it('has no story for a number the file does not hold', () => {
    expect(storyOf(mammals, 1, null)).toBeNull();
  });
});
