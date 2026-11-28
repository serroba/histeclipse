import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { APART, LAND, loadLifeDoors, type LifeDoors } from '../../data/lifeDoors';
import { parseLife } from '../../data/lifeStories';
import { doorRows, wayTo, withDoors } from './doors';
import { storyOf, type Story } from './story';

const mammals = parseLife(
  JSON.parse(readFileSync('public/data/life-stories/mammals.json', 'utf8')),
);
const doors: Promise<LifeDoors> = loadLifeDoors('doors.json', () =>
  Promise.resolve(new Response(readFileSync('public/data/life-stories/doors.json', 'utf8'))),
);

function story(name: string): Story {
  const node = mammals.nodes.find((each) => each.name === name);
  const told = storyOf(mammals, node?.pbdb ?? -1, null);
  if (told === null) throw new Error(`no story for ${name}`);
  return told;
}

const land = (file: LifeDoors, name: string): number => file.lands.indexOf(name);

describe('the doors between the continents', () => {
  it('has Panama shut 15 million years ago and open 5 million years ago, on the maps', async () => {
    const file = await doors;
    const [north, south] = [land(file, 'North America'), land(file, 'South America')];
    expect(wayTo(file, 15, new Set([north]), south).state).toBe(APART);
    const way = wayTo(file, 5, new Set([north]), south);
    expect(way.state).toBe(LAND);
    expect(way.through).toEqual(['North America', 'South America']);
  });

  it('finds a way through the lands between: Africa to North America by Asia, 15 million years ago', async () => {
    const file = await doors;
    const way = wayTo(file, 15, new Set([land(file, 'Africa')]), land(file, 'North America'));
    expect(way.state).toBe(LAND);
    expect(way.through.at(0)).toBe('Africa');
    expect(way.through.at(-1)).toBe('North America');
    expect(way.through).toContain('Asia');
  });

  it('says of each new continent in the cats’ story whether land joined it', async () => {
    const told = withDoors(story('Felidae'), await doors);
    const south = told.chapters.find((chapter) => chapter.title === 'First found in South America');
    expect(south?.text).toContain('Land joined it to North America');
    for (const chapter of told.chapters) {
      if (!chapter.title.startsWith('First found in')) continue;
      expect(chapter.text).toMatch(/Land joined it|shallow sea|sea lay between/);
    }
  });

  it('charts only doors between lands the story has finds on', async () => {
    const file = await doors;
    const rows = doorRows(story('Proboscidea'), file);
    expect(rows.map((row) => row.name)).toContain('North America – Asia');
    expect(rows.some((row) => row.name.includes('Antarctica'))).toBe(false);
  });
});
