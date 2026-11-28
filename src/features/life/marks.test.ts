import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseLife, type LifeData } from '../../data/lifeStories';
import { marksAt } from './marks';
import { storyOf, type Story } from './story';

function served(id: string): LifeData {
  return parseLife(JSON.parse(readFileSync(`public/data/life-stories/${id}.json`, 'utf8')));
}

const mammals = served('mammals');
const dinosaurs = served('dinosaurs');

function told(data: LifeData, name: string, focus: string | null = null): Story {
  const numbered = (wanted: string | null): number | null =>
    data.nodes.find((node) => node.name === wanted)?.pbdb ?? null;
  const story = storyOf(data, numbered(name) ?? -1, numbered(focus));
  if (story === null) throw new Error(`no story for ${name}`);
  return story;
}

describe('what an animal’s story marks on the globe', () => {
  const cats = told(mammals, 'Felidae', 'Panthera');

  it('marks each site of the step, the picked kind’s first, then the newly found kinds’', () => {
    const marks = marksAt(cats, 10);
    expect(marks[0]?.kind).toBe('focus');
    expect(marks[0]?.node.name).toBe('Panthera');
    const kinds = marks.map((mark) => mark.kind);
    expect(kinds.indexOf('began')).toBeLessThan(kinds.indexOf('found'));
    for (const mark of marks) {
      expect(mark.latitude).toBe(mark.site.latitude);
      expect(mark.finds).toBe(mark.site.finds);
    }
  });

  it('says of each mark its kind and its finds, one find in the singular', () => {
    const titles = marksAt(cats, 10).map((mark) => mark.title);
    expect(titles).toContain('Panthera: 3 finds');
    expect(titles.some((title) => title.endsWith(': 1 find, its oldest'))).toBe(true);
  });

  it('leads each kind with its site of the most finds in the step', () => {
    const smilodon = marksAt(cats, 0).filter((mark) => mark.node.name === 'Smilodon');
    expect(smilodon.filter((mark) => mark.lead)).toHaveLength(1);
    expect(smilodon.find((mark) => mark.lead)?.finds).toBe(
      Math.max(...smilodon.map((mark) => mark.finds)),
    );
  });

  it('marks where a kind was last seen, a step on from its last finds', () => {
    const last = cats.members.find((kind) => kind.node.name === 'Proailurus')?.last ?? 0;
    const after = marksAt(cats, last - 5).filter((mark) => mark.node.name === 'Proailurus');
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((mark) => mark.kind === 'ended')).toBe(true);
    expect(after[0]?.title).toBe(`Proailurus: last found here, ${String(last)} million years ago`);
    expect(marksAt(cats, last - 10).some((mark) => mark.node.name === 'Proailurus')).toBe(false);
  });

  it('marks as lost, in the last step, the kinds found then that do not live', () => {
    const now = marksAt(cats, 0);
    const smilodon = now.find((mark) => mark.node.name === 'Smilodon');
    expect(smilodon?.kind).toBe('ended');
    expect(smilodon?.title).toMatch(/among its last$/);
    expect(now.find((mark) => mark.node.name === 'Panthera')?.kind).toBe('focus');
  });

  it('marks nothing but endings a step after a lineage’s last finds', () => {
    const tyrants = told(dinosaurs, 'Tyrannosauridae');
    const end = tyrants.steps.at(-1)?.ma ?? 0;
    const after = marksAt(tyrants, end - 5);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((mark) => mark.kind === 'ended')).toBe(true);
  });

  it('keeps to the most telling sites when a step has more than it can show', () => {
    const all = told(mammals, 'Mammalia');
    expect(marksAt(all, 0)).toHaveLength(220);
    expect(marksAt(all, 0, 5)).toHaveLength(5);
  });
});
