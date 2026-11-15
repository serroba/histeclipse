import { describe, expect, it } from 'vitest';

import data from '../../../public/data/spacecraft.json';
import { loadSpacecraft } from '../../data/spacecraft';
import { DEPARTING_PACE, EASE_SECONDS, departures, launchPace, seenFrom } from './launchPace';

const record = await loadSpacecraft('spacecraft.json', () =>
  Promise.resolve(new Response(JSON.stringify(data))),
);
const departed = departures(record.craft);
const LUNA_1_LEFT = 2_436_571.659; // 1959-01-03 03:49 UT
const PIONEER_7_LEFT = 2_439_355.158; // 1966-08-17 15:47 UT
const YEAR_1966 = [2_439_126.5, 2_439_491.5] as const;
/** The camera at its first, a few Earth radii out; and out among the planets, some 6½ AU. */
const NEAR_EARTH = 4.5;
const AMONG_THE_PLANETS = 152_000;

/** Seconds of play from `from` until the pace first reaches `pace` (stepping 1/1000 s). */
function secondsUntil(pace: (jd: number) => number, from: number, reached: number): number {
  const step = 1 / 1000;
  let jd = from;
  let seconds = 0;
  while (pace(jd) < reached * 0.999 && seconds < 60) {
    jd += pace(jd) * step;
    seconds += step;
  }
  return seconds;
}

describe('how fast the launches play (#702)', () => {
  it('Given the record, Then each craft leaving Earth orbit is counted once, in order, from Luna 1', () => {
    const days = departed.map(({ jd }) => jd);
    expect(days[0]).toBeCloseTo(LUNA_1_LEFT, 2);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(new Set(days).size).toBe(days.length);
    expect(days.length).toBeGreaterThan(200);
  });

  it('Given a craft leaving, Then it plays slowly from half a day before to three days after', () => {
    const days = [1000];
    expect(launchPace(days, 999.5, 200)).toBeCloseTo(DEPARTING_PACE);
    expect(launchPace(days, 1001.5, 200)).toBeCloseTo(DEPARTING_PACE);
    expect(launchPace(days, 1003, 200)).toBeCloseTo(DEPARTING_PACE);
  });

  it('Given a moment far from any departure, Then it plays at the pace picked', () => {
    expect(launchPace([1000, 2000], 1500, 200)).toBeCloseTo(200);
    expect(launchPace([1000], 900, 50)).toBeCloseTo(50);
    expect(launchPace([], 900, 50)).toBeCloseTo(50);
  });

  it('Given the moments either side, Then the pace eases between, faster the farther away', () => {
    const days = [1000];
    const after = [1003.5, 1005, 1007, 1009].map((jd) => launchPace(days, jd, 50));
    expect(after).toEqual([...after].sort((a, b) => a - b));
    expect(after[0]).toBeGreaterThan(DEPARTING_PACE);
    expect(after.at(-1)).toBeLessThan(50);
    const before = [990, 993, 996, 999].map((jd) => launchPace(days, jd, 50));
    expect(before).toEqual([...before].sort((a, b) => b - a));
  });

  it('Given any pace picked, When it eases either way, Then the easing takes half a second of play (#769)', () => {
    const days = [1000];
    for (const cruising of [50, 100, 200, 400]) {
      const pace = (jd: number) => launchPace(days, jd, cruising);
      // Out of the slow stretch, three days after leaving, up to the pace picked.
      expect(secondsUntil(pace, 1003, cruising)).toBeCloseTo(EASE_SECONDS, 2);
      // Back the other way: from the pace picked down to slow, half a day before.
      const reversed = (jd: number) => launchPace(days, 2 * 999.5 - jd, cruising);
      expect(secondsUntil(reversed, 999.5, cruising)).toBeCloseTo(EASE_SECONDS, 2);
    }
  });

  it('Given a pace picked slower than leaving, Then it never speeds up for a departure', () => {
    expect(launchPace([1000], 1001, 4)).toBeCloseTo(4);
    expect(launchPace([1000], 1001, DEPARTING_PACE)).toBeCloseTo(DEPARTING_PACE);
  });
});

describe('the departures seen from where the camera is (#769)', () => {
  const in1966 = (days: readonly number[]) =>
    days.filter((jd) => jd >= YEAR_1966[0] && jd < YEAR_1966[1]);

  it('Given the camera near Earth, Then every craft leaving is seen, the trips to the Moon too', () => {
    expect(seenFrom(departed, NEAR_EARTH)).toEqual(departed.map(({ jd }) => jd));
    expect(in1966(seenFrom(departed, NEAR_EARTH)).length).toBeGreaterThanOrEqual(11);
  });

  it('Given the camera out among the planets, Then only craft heading out about the Sun are seen: in 1966, Pioneer 7 alone', () => {
    const seen = seenFrom(departed, AMONG_THE_PLANETS);
    expect(seen.length).toBeGreaterThan(80);
    expect(seen.length).toBeLessThan(departed.length / 2);
    expect(seen).not.toContainEqual(departed[0]?.jd);
    const year = in1966(seen);
    expect(year).toHaveLength(1);
    expect(year[0]).toBeCloseTo(PIONEER_7_LEFT, 0);
  });

  it('Given the camera between, Then craft heading for the Sun–Earth L points are seen, but not those for the Moon', () => {
    const seen = new Set(seenFrom(departed, 10_000));
    const reaches = new Set(departed.filter(({ jd }) => seen.has(jd)).map(({ reach }) => reach));
    const all = new Set(departed.map(({ reach }) => reach));
    expect(all.size).toBe(3);
    expect(reaches.size).toBe(2);
    expect(Math.min(...reaches)).toBeGreaterThan(Math.min(...all));
  });
});
