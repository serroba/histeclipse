import { describe, expect, it } from 'vitest';

import data from '../../public/data/spacecraft.json';
import { gcatJd, loadSpacecraft } from './spacecraft';
import { missionNamed, missions, missionView, type Mission } from './spacecraftMission';

const record = await loadSpacecraft('spacecraft.json', () =>
  Promise.resolve(new Response(JSON.stringify(data))),
);
const TODAY = gcatJd('2026-11-14');
const all = missions(record.craft, TODAY);
const titled = (title: string): Mission => {
  const found = all.find((mission) => mission.title === title);
  if (found === undefined) throw new Error(`no mission ${title}`);
  return found;
};
const chapters = (mission: Mission) => mission.chapters.map(({ name }) => name);

describe('a mission as one journey (#712)', () => {
  it('Given the record, Then each launch is one mission, in order, from Luna 1', () => {
    expect(all).toHaveLength(new Set(record.craft.map(({ launchTag }) => launchTag)).size);
    expect(all[0]?.title).toBe('Luna 1');
    const starts = all.map(({ start }) => start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('Given Apollo 11, Then Columbia and Eagle fly it together, a week from leaving to home', () => {
    const apollo = titled('Apollo 11');
    expect(apollo.craft.map(({ name }) => name)).toEqual(['Columbia', 'Eagle']);
    expect(apollo.end - apollo.start).toBeCloseTo(7, 0);
    expect(chapters(apollo)).toEqual([
      'Leaves Earth',
      'Reaches the Moon',
      'Eagle: Lands on the Moon',
      'Columbia: Back at Earth',
      'Columbia: Home',
    ]);
    expect(apollo.chapters[2]?.jd).toBeCloseTo(gcatJd('1969-07-20T20:17'), 5);
    expect(apollo.aboutEarth).toBe(true);
  });

  it('Given Voyager 2, Then its chapters are the four giant planets, and it is followed a year past Neptune', () => {
    const voyager = titled('Voyager 2');
    expect(chapters(voyager)).toEqual([
      'Leaves Earth',
      'Reaches Jupiter',
      'Reaches Saturn',
      'Reaches Uranus',
      'Reaches Neptune',
    ]);
    expect(voyager.end - gcatJd('1989-11-12T20:00')).toBeCloseTo(365, 0);
    expect(voyager.reach).toBeCloseTo(30.1);
  });

  it('Given Cassini, Then passing Saturn’s moons is being at Saturn, and Huygens’s landing is its own', () => {
    expect(chapters(titled('Cassini'))).toEqual([
      'Leaves Earth',
      'Reaches Venus',
      'Reaches Venus',
      'Back at Earth',
      'Reaches Jupiter',
      'Reaches Saturn',
      'Huygens: Lands on Titan',
    ]);
  });

  it('Given a link naming any of its craft, Then that mission is found; an unknown one, none', () => {
    expect(missionNamed(all, 'D00274')?.title).toBe('Apollo 11');
    expect(missionNamed(all, titled('Apollo 11').id)?.title).toBe('Apollo 11');
    expect(missionNamed(all, 'd99999')).toBeNull();
  });

  it('Given a mission to the Moon, an L point or the planets, Then its view frames where it went, from its start', () => {
    expect(missionView(titled('Apollo 11'))).toBe(
      'focus=earth&cam=89.0000,0.0000,200.00&layers=spacecraft&mission=d00273&t=1969-07-17T16:41Z',
    );
    expect(missionView(titled('James Webb Space Telescope'))).toMatch(
      /^focus=earth&cam=89\.0000,0\.0000,700\.00&/,
    );
    // Mars: 1.52 AU, and a little more, in the Sun's radii, from above the planets.
    expect(missionView(titled('Mars 2020'))).toMatch(
      /^focus=sun&cam=66\.5607,-90\.0000,457\.59&layers=spacecraft&mission=d01038&t=2020-07-30T20:49Z$/,
    );
    // Beyond Saturn, as far as the view reaches.
    expect(missionView(titled('Voyager 2'))).toMatch(/cam=66\.5607,-90\.0000,2747\.30&/);
  });
});
