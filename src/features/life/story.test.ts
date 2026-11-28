import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseLife, type LifeData } from '../../data/lifeStories';
import { branches, generaWithin, stepAt, storyOf, type Story } from './story';

function served(id: string): LifeData {
  return parseLife(JSON.parse(readFileSync(`public/data/life-stories/${id}.json`, 'utf8')));
}

const mammals = served('mammals');
const dinosaurs = served('dinosaurs');

function numbered(data: LifeData, name: string): number {
  return data.nodes.find((node) => node.name === name)?.pbdb ?? -1;
}

function told(data: LifeData, name: string, focus: string | null = null): Story {
  const story = storyOf(data, numbered(data, name), focus === null ? null : numbered(data, focus));
  if (story === null) throw new Error(`no story for ${name}`);
  return story;
}

describe('an animal’s story', () => {
  it('is of a lineage’s kinds, with the one asked for picked out and its ancestors named', () => {
    const cats = told(mammals, 'Felidae', 'Panthera');
    expect(cats.clade.name).toBe('Felidae');
    expect(cats.focus?.name).toBe('Panthera');
    expect(cats.ancestry.at(0)?.name).toBe('Mammalia');
    expect(cats.ancestry.at(-1)?.name).toBe('Felidae');
    expect(cats.kinds).toBe(cats.members.length);
    expect(cats.living).toBeGreaterThan(0);
  });

  it('picks no kind out when none is asked for, or the one asked for is not in it', () => {
    expect(told(mammals, 'Felidae').focus).toBeNull();
    expect(told(mammals, 'Felidae', 'Equus').focus).toBeNull();
  });

  it('has no story for a number the file does not hold', () => {
    expect(storyOf(mammals, 1, null)).toBeNull();
  });

  it('runs its steps from its oldest finds to today while a kind lives, oldest first', () => {
    const horses = told(mammals, 'Equidae');
    const moments = horses.steps.map((step) => step.ma);
    expect(moments.at(0)).toBe(55);
    expect(moments.at(-1)).toBe(0);
    expect(moments).toEqual([...moments].sort((a, b) => b - a));
  });

  it('ends its steps at its last finds when none of its kinds lives', () => {
    const tyrants = told(dinosaurs, 'Tyrannosauridae');
    expect(tyrants.living).toBe(0);
    expect(tyrants.steps.at(-1)?.ma).toBeGreaterThan(60);
  });

  it('counts each step’s finds by region, and its kinds as those known before and after', () => {
    const horses = told(mammals, 'Equidae');
    for (const step of horses.steps) {
      expect(step.byRegion.reduce((sum, count) => sum + count, 0)).toBe(step.finds);
      expect(step.kinds).toBeGreaterThanOrEqual(step.began.length);
    }
    // After a first reach into Europe and Asia, North America alone for 20 million years.
    const alone = horses.steps.filter((step) => step.ma <= 45 && step.ma >= 25);
    expect(alone).toHaveLength(5);
    expect(alone.every((step) => step.finds === step.byRegion[0])).toBe(true);
  });

  it('reads how warm it was where they lay beside the globe’s mean, and neither with no map', () => {
    const primates = told(mammals, 'Primates');
    const warm = primates.steps.find((step) => step.ma === 30);
    expect(warm?.celsius).toBeGreaterThan(warm?.globe ?? Infinity);
    // The 65 Ma map is left out as an outlier: its step has finds and no temperature.
    const unmapped = primates.steps.find((step) => step.ma === 65);
    expect(unmapped?.finds).toBeGreaterThan(0);
    expect(unmapped?.celsius).toBeNull();
    expect(unmapped?.globe).toBeNull();
  });

  it('names the kinds a step begins, most found first, and those it ends unless they live', () => {
    const cats = told(mammals, 'Felidae');
    expect(cats.steps[0]?.began.map((node) => node.name)).toEqual(['Proailurus']);
    const last = cats.steps.at(-1);
    expect(last?.ended.map((node) => node.name)).toContain('Smilodon');
    expect(last?.ended.map((node) => node.name)).not.toContain('Panthera');
  });

  it('takes a moment to the nearest step', () => {
    const cats = told(mammals, 'Felidae');
    expect(stepAt(cats, 12.4)).toBe(10);
    expect(stepAt(cats, 12.6)).toBe(15);
  });

  it('lists the lineages within it, most kinds first, and none within a single kind', () => {
    const cats = told(mammals, 'Felidae');
    const inner = branches(cats);
    expect(inner[0]?.node.name).toBe('Machairodontinae');
    expect(inner.map((each) => each.kinds)).toEqual(
      [...inner.map((each) => each.kinds)].sort((a, b) => b - a),
    );
    expect(branches(cats, 2)).toHaveLength(2);
    expect(branches(told(mammals, 'Panthera'))).toEqual([]);
  });

  it('gathers the genera within a node, itself if it is one', () => {
    const panthera = mammals.nodes.find((node) => node.name === 'Panthera');
    expect(generaWithin(mammals, panthera?.index ?? 0).map((node) => node.name)).toEqual([
      'Panthera',
    ]);
  });
});
