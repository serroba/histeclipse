import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseLife, type LifeData } from '../../data/lifeStories';
import { everydayNames, findAnimals, storyFor, SUGGESTED } from './names';

function served(id: string): LifeData {
  return parseLife(JSON.parse(readFileSync(`public/data/life-stories/${id}.json`, 'utf8')));
}

const groups = [served('mammals'), served('dinosaurs')];
const [mammals] = groups;

function found(query: string, most?: number): string[] {
  return findAnimals(groups, query, most).map(
    (each) => `${each.known === '' ? '' : `${each.known}=`}${each.node.name}`,
  );
}

describe('finding an animal by the name a reader knows', () => {
  it('finds an everyday name’s genus first, whatever the case or the spaces round it', () => {
    expect(found('lion')[0]).toBe('lion=Panthera');
    expect(found('  LION ')[0]).toBe('lion=Panthera');
    expect(found('t. rex')).toEqual(['t. rex=Tyrannosaurus']);
  });

  it('finds a scientific name by its start, and PBDB’s common names', () => {
    expect(found('Tyrannosaurus')[0]).toBe('Tyrannosaurus');
    expect(found('smilo')[0]).toBe('Smilodon');
    expect(found('proboscidean')).toContain('proboscidean=Proboscidea');
  });

  it('finds a word inside a name, and letters inside it once there are three', () => {
    expect(found('sea lion')[0]).toBe('sea lion=Zalophus');
    expect(found('lion')).toContain('sea lion=Zalophus');
    expect(found('odon', 40).some((name) => name.endsWith('odon'))).toBe(true);
    expect(found('zz')).toEqual([]);
  });

  it('finds nothing for nothing, and no animal twice', () => {
    expect(found('')).toEqual([]);
    expect(found('   ')).toEqual([]);
    const cats = findAnimals(groups, 'cat', 40).map((each) => each.node.pbdb);
    expect(new Set(cats).size).toBe(cats.length);
  });

  it('finds no more than asked for', () => {
    expect(found('a')).toHaveLength(12);
    expect(found('a', 3)).toHaveLength(3);
  });

  it('has every suggestion to offer, and every everyday name’s lineage in the files', () => {
    for (const name of SUGGESTED) expect(found(name, 1)).toHaveLength(1);
  });

  it('knows a genus’s everyday names: the first as written, then the others of one word', () => {
    expect(everydayNames('mammals', 'Panthera')).toEqual(['lion', 'tiger', 'leopard', 'jaguar']);
    expect(everydayNames('dinosaurs', 'Tyrannosaurus')).toEqual(['t. rex']);
    expect(everydayNames('mammals', 'Proailurus')).toEqual([]);
  });
});

describe('the story an animal is told in', () => {
  const named = (name: string) => {
    const node = mammals?.nodes.find((each) => each.name === name);
    if (mammals === undefined || node === undefined) throw new Error(`no ${name}`);
    return { data: mammals, node };
  };

  it('is a genus’s family’s, with the genus picked out', () => {
    const { data, node } = named('Panthera');
    const felidae = data.nodes.find((each) => each.name === 'Felidae');
    expect(storyFor(data, node)).toEqual({ pbdb: felidae?.pbdb, focus: node.pbdb });
  });

  it('is a lineage’s own, with no kind picked out', () => {
    const { data, node } = named('Felidae');
    expect(storyFor(data, node)).toEqual({ pbdb: node.pbdb, focus: null });
  });

  it('is its parent’s, for a genus in no family', () => {
    const data = mammals;
    const orphan = data?.nodes.find(
      (node) =>
        node.sites.length > 0 &&
        (() => {
          for (let at = node.parent; at >= 0; at = data.nodes[at]?.parent ?? -1) {
            if (data.nodes[at]?.rank === 'family') return false;
          }
          return true;
        })(),
    );
    if (data === undefined || orphan === undefined) throw new Error('no genus outside a family');
    expect(storyFor(data, orphan)).toEqual({
      pbdb: data.nodes[orphan.parent]?.pbdb,
      focus: orphan.pbdb,
    });
  });
});
