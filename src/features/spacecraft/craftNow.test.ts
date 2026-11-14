import { describe, expect, it } from 'vitest';

import type { Craft, CraftPhase } from '../../data/spacecraft';
import type { CraftPaths } from '../../data/spacecraftPaths';
import { elementAt } from '../../util/arrays';
import { gcatJd } from '../../data/spacecraft';
import type { Geocentric } from './approximatePaths';
import { craftNow, craftWheres, fromEarth, inFlight, remembered, trailMoments } from './craftNow';

const AU = 149_597_870.7;
/** A still Sun, 1 AU along x from Earth; the Moon and Mars at fixed places. */
const geocentric: Geocentric = (body) =>
  body === 'Sun'
    ? [AU, 0, 0]
    : body === 'Moon'
      ? [384_400, 0, 0]
      : body === 'Mars'
        ? [0, AU, 0]
        : null;

function craft(id: string, phases: CraftPhase[], extra: Partial<Craft> = {}): Craft {
  return {
    id,
    name: `Craft ${id}`,
    cospar: '2000-001A',
    nssdc: '2000-001A',
    launchTag: '2000-001',
    launch: '2000-01-01',
    owner: 'X',
    state: 'US',
    crewed: false,
    part: false,
    parent: null,
    phases,
    ...extra,
  };
}

const T = gcatJd('2000-06-01');
const PATHS: CraftPaths = {
  // About the Sun, still at (2 AU, 0, 0) from it over 2000.
  D1: [
    {
      centre: 'Sun',
      points: [
        [gcatJd('2000-01-01') - 2_400_000, 2 * AU, 0, 0],
        [gcatJd('2001-01-01') - 2_400_000, 2 * AU, 0, 0],
      ],
    },
  ],
};

describe('the craft in flight at a moment, and where', () => {
  const record = [
    craft('D1', [['Sun', '2000-01-01', null, 'O', 'HCO']], { mission: 'Voyager' }),
    craft('D2', [['Mars', '2000-01-01', null, 'O', '-']]),
    craft('D3', [['Earth', '2000-01-01', '2000-12-01', 'O', '-']]),
    craft('D4', [['Sun', '2001-01-01', null, 'O', 'HCO']]),
  ];
  const wheres = craftWheres(PATHS, geocentric);
  const now = craftNow(record, wheres, geocentric, T);

  it('Given a craft Horizons has, Then it is where its path is, from Earth, named by its mission', () => {
    const voyager = now.find(({ id }) => id === 'D1');
    expect(voyager?.name).toBe('Voyager');
    expect(voyager?.km).toEqual([3 * AU, 0, 0]);
    expect(voyager?.approximate).toBe(false);
    expect(voyager?.trail).toHaveLength(24);
  });

  it('Given a craft in orbit at Mars, Then it is at Mars, on its approximate path', () => {
    const orbiter = now.find(({ id }) => id === 'D2');
    expect(orbiter?.km).toEqual([0, AU, 0]);
    expect(orbiter?.at).toBe('Mars');
    expect(orbiter?.approximate).toBe(true);
    // It is there: no stray trail across space (#716).
    expect(orbiter?.trail).toEqual([]);
  });

  it('Given a craft still about Earth, or not yet launched, Then it is not drawn', () => {
    expect(now.map(({ id }) => id).sort()).toEqual(['D1', 'D2']);
    expect(inFlight(elementAt(record, 3), T)).toBe(false);
  });

  it('Given a place about the Sun at another time, Then it is seen from where Earth is now', () => {
    expect(fromEarth({ centre: 'Sun', km: [AU, 0, 0] }, T - 10, geocentric, T)).toEqual([
      2 * AU,
      0,
      0,
    ]);
    expect(fromEarth({ centre: 'Earth', km: [1, 2, 3] }, T, geocentric)).toEqual([1, 2, 3]);
    expect(fromEarth({ at: 'Luna' }, T, geocentric)).toEqual([384_400, 0, 0]);
    expect(fromEarth({ at: 'Uranus' }, T, geocentric)).toBeNull();
    expect(fromEarth({ centre: 'Sun', km: [AU, 0, 0] }, T, () => null)).toBeNull();
  });

  it('Given a craft with no record of its start, Then it is not in flight', () => {
    expect(inFlight(craft('D5', [['Sun', null, null, 'O', '-']]), T)).toBe(false);
  });

  it('Given a craft near Earth, Then its trail reaches back hours, and stops at its launch', () => {
    const near = craft('D6', [['Earth', '2000-06-01', '2000-06-10', 'EO', 'Luna']]);
    const paths: CraftPaths = {
      D6: [
        {
          centre: 'Earth',
          points: [
            [gcatJd('2000-06-01') - 2_400_000, 7000, 0, 0],
            [gcatJd('2000-06-10') - 2_400_000, 300_000, 0, 0],
          ],
        },
      ],
    };
    const [one] = craftNow(
      [near],
      craftWheres(paths, geocentric),
      geocentric,
      gcatJd('2000-06-01T12:00'),
    );
    // Half a day in: the trail runs back a day or two, cut where the path begins.
    expect(one?.trail.length).toBeGreaterThan(0);
    expect(one?.trail.length).toBeLessThan(24);
  });

  it('Given a craft at a world the site cannot place, Then it is not drawn', () => {
    const far = craft('D7', [['Uranus', '2000-01-01', null, 'O', '-']]);
    const wheres = {
      where: () => ({ at: 'Uranus' }),
      approximate: () => true,
    };
    expect(craftNow([far], wheres, geocentric, T)).toEqual([]);
  });
});

describe('where the bodies are, for the craft (#702)', () => {
  it('Given the same body asked for at the same moment, Then it is worked out once', () => {
    let asked = 0;
    const once = remembered((body, jd) => {
      asked += 1;
      return body === 'Nowhere' ? null : [jd, 0, 0];
    });
    expect(once('Sun', 10)).toEqual([10, 0, 0]);
    expect(once('Sun', 10)).toEqual([10, 0, 0]);
    expect(once('Sun', 11)).toEqual([11, 0, 0]);
    expect(once('Mars', 10)).toEqual([10, 0, 0]);
    expect(asked).toBe(3);
  });

  it('Given a place not yet known, Then it is asked for again', () => {
    let loaded = false;
    const once = remembered(() => (loaded ? [1, 2, 3] : null));
    expect(once('Mars', 10)).toBeNull();
    loaded = true;
    expect(once('Mars', 10)).toEqual([1, 2, 3]);
  });

  it('Given more places than it keeps, Then it lets them go and keeps on', () => {
    let asked = 0;
    const once = remembered((_, jd) => {
      asked += 1;
      return [jd, 0, 0];
    }, 2);
    once('Sun', 1);
    once('Sun', 2);
    once('Sun', 3);
    once('Sun', 3);
    expect(asked).toBe(3);
  });

  it('Given a moment, Then a trail reaches back on a grid of whole steps, the same from frame to frame', () => {
    expect(trailMoments(100.3, 2.5).slice(0, 3)).toEqual([100, 97.5, 95]);
    expect(trailMoments(101.2, 2.5).slice(0, 3)).toEqual([100, 97.5, 95]);
    expect(trailMoments(100, 2.5)[0]).toBe(97.5);
    expect(trailMoments(100.3, 2.5)).toHaveLength(24);
  });
});
