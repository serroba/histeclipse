import { describe, expect, it } from 'vitest';

import data from '../../public/data/spacecraft.json';
import { gcatJd, loadSpacecraft } from './spacecraft';
import { earthFixedToJ2000, sunPositionJ2000 } from '../astro/precession';
import type { JulianDay } from '../time/julianDay';
import {
  besideTheSunLine,
  missionNamed,
  missions,
  missionView,
  type Mission,
} from './spacecraftMission';

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
    expect(apollo.lPoint).toBeNull();
  });

  it('Given the James Webb Space Telescope, Then it goes to L2, and its route turns with the Sun (#995)', () => {
    const webb = titled('James Webb Space Telescope');
    expect(webb.lPoint).toBe('SEL2');
    const arrives = webb.chapters.find(({ name }) => name === 'Reaches the Sun–Earth L2 point');
    expect(arrives?.meaning).toContain('the Sun held still');
    expect(webb.aboutEarth).toBe(true);
    expect(titled('Voyager 2').lPoint).toBeNull();
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
    // An L point: beside the Sun–Earth line, not above the pole, where its loops are edge on.
    const webb = titled('James Webb Space Telescope');
    expect(missionView(webb)).toBe(
      `focus=earth&cam=${besideTheSunLine(webb.start)},1000.00&layers=spacecraft&mission=d01093&t=2021-12-26T02:23Z`,
    );
    // Mars: 1.52 AU, and a little more, in the Sun's radii, from above the planets.
    expect(missionView(titled('Mars 2020'))).toMatch(
      /^focus=sun&cam=66\.5607,-90\.0000,457\.59&layers=spacecraft&mission=d01038&t=2020-07-30T20:49Z$/,
    );
    // Beyond Saturn, as far as the view reaches.
    expect(missionView(titled('Voyager 2'))).toMatch(/cam=66\.5607,-90\.0000,2747\.30&/);
  });
});

describe('the view of a mission to a Sun–Earth L point (#995)', () => {
  it('Given a moment, Then the camera looks from beside the Sun–Earth line, away from the Sun and a little above the ecliptic', () => {
    const jd = gcatJd('2021-12-26T02:23') as JulianDay;
    const [lat, lon] = besideTheSunLine(jd)
      .split(',')
      .map((each) => (Number(each) * Math.PI) / 180);
    const fixed = [
      Math.cos(lat ?? 0) * Math.cos(lon ?? 0),
      Math.cos(lat ?? 0) * Math.sin(lon ?? 0),
      Math.sin(lat ?? 0),
    ] as const;
    const m = earthFixedToJ2000(jd, jd);
    const look = m.map((row) => row[0] * fixed[0] + row[1] * fixed[1] + row[2] * fixed[2]);
    const sun = sunPositionJ2000(jd);
    const r = Math.hypot(...sun);
    const fromSun = look.reduce((sum, c, i) => sum + c * (sun[i] ?? 0), 0) / r;
    // −0.75 along the Sun, of a direction 0.99 long: some 40° from the line, away from the Sun.
    expect(fromSun).toBeCloseTo(-0.75 / Math.hypot(0.75, 0.55, 0.35), 3);
    const obliquity = 0.409_092_6;
    const above = -Math.sin(obliquity) * (look[1] ?? 0) + Math.cos(obliquity) * (look[2] ?? 0);
    expect(above).toBeCloseTo(0.35 / Math.hypot(0.75, 0.55, 0.35), 3);
  });
});
