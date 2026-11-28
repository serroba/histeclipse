import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { APART, doorAt, LAND, loadLifeDoors } from './lifeDoors';

const body = readFileSync('public/data/life-stories/doors.json', 'utf8');
const answering = (text: string) => () => Promise.resolve(new Response(text));

describe('the doors between the continents, as served', () => {
  it('reads the file: the stories’ regions and India, and a state a step for each door', async () => {
    const doors = await loadLifeDoors('doors.json', answering(body));
    expect(doors.lands.slice(0, 7)).toEqual([
      'North America',
      'South America',
      'Europe',
      'Africa',
      'Asia',
      'Oceania',
      'Antarctica',
    ]);
    expect(doors.lands).toContain('India');
    for (const door of doors.doors) expect(door.states).toHaveLength(doors.steps.length);
  });

  it('says how a door stood at the step nearest a moment, and apart beyond the steps', async () => {
    const doors = await loadLifeDoors('doors.json', answering(body));
    const india = doors.doors.find(
      (door) => doors.lands[door.a] === 'Asia' && doors.lands[door.b] === 'India',
    );
    if (india === undefined) throw new Error('no door between Asia and India');
    expect(doorAt(doors, india, 11)).toBe(LAND);
    expect(doorAt(doors, india, 60)).toBe(APART);
    expect(doorAt(doors, india, 4000)).toBe(APART);
  });

  it('refuses a door that joins a land the file does not name, or lacks a step’s state', async () => {
    const file = JSON.parse(body) as { doors: { a: number; b: number; states: number[] }[] };
    const [first] = file.doors;
    if (first === undefined) throw new Error('no doors');
    const broken = (door: object): Promise<unknown> =>
      loadLifeDoors('doors.json', answering(JSON.stringify({ ...file, doors: [door] })));
    await expect(broken({ ...first, b: 99 })).rejects.toThrow();
    await expect(broken({ ...first, a: first.b, b: first.a })).rejects.toThrow();
    await expect(broken({ ...first, states: [0] })).rejects.toThrow();
  });
});
