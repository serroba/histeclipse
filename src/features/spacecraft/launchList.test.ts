import { describe, expect, it } from 'vitest';

import data from '../../../public/data/spacecraft.json';
import { loadSpacecraft } from '../../data/spacecraft';
import { launchDate, launchMoments } from './launchList';

const serve = () => Promise.resolve(new Response(JSON.stringify(data)));
const record = await loadSpacecraft('spacecraft.json', serve);
const launches = launchMoments(record.craft);

describe('the launches the bar plays through (#702)', () => {
  it('Given the record, Then the first is Luna 1, on 2 January 1959, and they run in order to this year', () => {
    expect(launches[0]?.name).toBe('Luna 1');
    expect(launches[0]?.date).toBe('2 Jan 1959');
    const days = launches.map(({ jd }) => jd);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(launches.at(-1)?.date).toMatch(/2026$/);
  });

  it('Given craft that shared a rocket, Then they are one launch, the capsule counted with its craft', () => {
    const tags = new Set(record.craft.map(({ launchTag }) => launchTag));
    expect(launches).toHaveLength(tags.size);
    const ranger = launches.filter(({ name }) => name.startsWith('Ranger 3'));
    expect(ranger.map(({ name }) => name)).toEqual(['Ranger 3']);
  });

  it('Given Apollo 11, Then its launch is named once, for the mission', () => {
    expect(launches.filter(({ name }) => name === 'Apollo 11')).toHaveLength(1);
  });

  it('Given a launch of several craft, Then two are named and the rest counted', () => {
    const many = launches.find(({ name }) => / and \d+ more$/.test(name));
    expect(many?.name.split(', ')).toHaveLength(2);
  });

  it('Given a day, Then it is written as the bar writes dates', () => {
    expect(launchDate(2_436_570.5)).toBe('2 Jan 1959');
  });
});
