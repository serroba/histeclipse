import { describe, expect, it } from 'vitest';

import data from '../../../public/data/spacecraft.json';
import { loadSpacecraft } from '../../data/spacecraft';
import { DEPARTING_PACE, departures, launchPace } from './launchPace';

const record = await loadSpacecraft('spacecraft.json', () =>
  Promise.resolve(new Response(JSON.stringify(data))),
);
const departed = departures(record.craft);
const LUNA_1_LEFT = 2_436_571.659; // 1959-01-03 03:49 UT

describe('how fast the launches play (#702)', () => {
  it('Given the record, Then each craft leaving Earth orbit is counted once, in order, from Luna 1', () => {
    expect(departed[0]).toBeCloseTo(LUNA_1_LEFT, 2);
    expect(departed).toEqual([...departed].sort((a, b) => a - b));
    expect(new Set(departed).size).toBe(departed.length);
    expect(departed.length).toBeGreaterThan(200);
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
    const paces = [1003.2, 1003.6, 1004, 1004.4].map((jd) => launchPace(days, jd, 200));
    expect(paces).toEqual([...paces].sort((a, b) => a - b));
    expect(paces[0]).toBeGreaterThan(DEPARTING_PACE);
    expect(paces.at(-1)).toBeLessThan(200);
    expect(launchPace(days, 998.75, 200)).toBeCloseTo(Math.sqrt(DEPARTING_PACE * 200));
  });

  it('Given a pace picked slower than leaving, Then it never speeds up for a departure', () => {
    expect(launchPace([1000], 1001, 4)).toBeCloseTo(4);
  });
});
