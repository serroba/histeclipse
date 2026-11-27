import { describe, expect, it } from 'vitest';

import type { Craft, CraftPhase } from '../../data/spacecraft';
import type { CraftPaths } from '../../data/spacecraftPaths';
import { elementAt } from '../../util/arrays';
import { gcatJd } from '../../data/spacecraft';
import type { Geocentric } from './approximatePaths';
import {
  craftNow,
  craftRoutes,
  craftWheres,
  fromEarth,
  inFlight,
  remembered,
  trailMoments,
  type CraftWheres,
} from './craftNow';

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

  it('Given a craft just gone from Mars, Then its trail ends where it left, never asking where Mars was (#765)', () => {
    const left = T - 5;
    const asked: string[] = [];
    const counting: Geocentric = (body, jdTT) => {
      asked.push(body);
      return geocentric(body, jdTT);
    };
    const leaving: CraftWheres = {
      where: (_, jdTT) => (jdTT < left ? { at: 'Mars' } : { centre: 'Sun', km: [2 * AU, 0, 0] }),
      approximate: () => true,
    };
    const [gone] = craftNow(
      [craft('D6', [['Sun', '2000-01-01', null, 'O', '-']])],
      leaving,
      counting,
      T,
    );
    // A 2.5-day grid: two points since it left, then the stay.
    expect(gone?.trail).toHaveLength(2);
    expect(asked).not.toContain('Mars');
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

  describe('a craft that stays about Earth (#795)', () => {
    const orbit = { perigeeKm: 611, apogeeKm: 620, inclinationDeg: 28.47, measured: '1990-05-24' };
    const hubble = craft('S20580', [['Earth', '1990-04-25T12:49?', null, 'O', '-']], { orbit });
    const wheres = craftWheres({}, geocentric);
    const radius = 6378.137 + 615.5;

    it('Given a moment after it was set free, Then it is on its circle about Earth, as approximate', () => {
      const [now] = craftNow([hubble], wheres, geocentric, gcatJd('2009-05-20'));
      expect(now?.approximate).toBe(true);
      expect(now?.ring).toBe(true);
      expect(now?.at).toBeNull();
      // Between its lowest and highest: Hubble's near-circle (#849).
      expect(Math.abs(Math.hypot(...(now?.km ?? [0, 0, 0])) - radius)).toBeLessThan(4.6);
    });

    it('Given it followed as a mission (#800), Then it has no route over its years, only its ring', () => {
      const followed = {
        from: gcatJd('1990-04-24'),
        to: gcatJd('2026-11-14'),
        aboutEarth: true,
        turning: false,
      };
      expect(craftRoutes([hubble], wheres, geocentric, gcatJd('2009-05-20'), followed)).toEqual([]);
      const [now] = craftNow([hubble], wheres, geocentric, gcatJd('2009-05-20'), followed);
      expect(now?.ring).toBe(true);
      expect(now?.trail).toHaveLength(60);
    });

    it('Given a moment before it was set free, Then it is not there', () => {
      expect(craftNow([hubble], wheres, geocentric, gcatJd('1990-04-20'))).toEqual([]);
      expect(wheres.where(hubble, gcatJd('1990-04-20'))).toBeNull();
    });

    it('Given an eased moment, Then its dot is drawn at that moment, and its ring still at the true one (#815)', () => {
      const jd = gcatJd('2009-05-20');
      const later = jd + 0.01;
      const [plain] = craftNow([hubble], wheres, geocentric, jd);
      const [eased] = craftNow([hubble], wheres, geocentric, jd, null, geocentric, () => later);
      expect(eased?.km).not.toEqual(plain?.km);
      expect(eased?.km).toEqual(craftNow([hubble], wheres, geocentric, later)[0]?.km);
      expect(eased?.trail).toEqual(plain?.trail);
    });

    it('Given its trail, Then it is the lap it has just made: a ring closed about Earth', () => {
      const [now] = craftNow([hubble], wheres, geocentric, gcatJd('2009-05-20T07:00'));
      const trail = now?.trail ?? [];
      expect(trail).toHaveLength(60);
      for (const point of trail) expect(Math.abs(Math.hypot(...point) - radius)).toBeLessThan(4.6);
      const here: readonly [number, number, number] = now?.km ?? [0, 0, 0];
      const oldest = elementAt(trail, trail.length - 1);
      // A lap back it was where it is now (#849), but for its plane's swing over that lap: under
      // half a degree, some 50 km at its height.
      const gap = Math.hypot(oldest[0] - here[0], oldest[1] - here[1], oldest[2] - here[2]);
      expect(gap).toBeLessThan(60);
    });
  });
});

describe('a mission to L2, held to the Sun (#995)', () => {
  const year = 365.25;
  const start = gcatJd('2000-01-01');
  const obliquity = (84_381.406 / 3600) * (Math.PI / 180);
  /** `r` km along the ecliptic, at the angle the Sun has gone round by `jd`, J2000 equatorial. */
  const along = (jd: number, r: number): [number, number, number] => {
    const angle = (2 * Math.PI * (jd - start)) / year;
    const y = r * Math.sin(angle);
    return [r * Math.cos(angle), y * Math.cos(obliquity), y * Math.sin(obliquity)];
  };
  const turningSun: Geocentric = (body, jd) => (body === 'Sun' ? along(jd, AU) : null);
  // A craft at L2 for a year, about Earth: 1.5 million km from Earth, away from the Sun, weekly.
  const points = Array.from({ length: 53 }, (_, k): [number, number, number, number] => {
    const jd = start + (k * year) / 52;
    return [jd - 2_400_000, ...along(jd, -1.5e6)];
  });
  const webb = craft('W1', [['SEL2', '2000-01-01', null, 'O', '-']]);
  const wheres = craftWheres({ W1: [{ centre: 'Earth', points }] }, turningSun);
  const shown = start + 200;
  const followed = { from: start, to: start + year, aboutEarth: true };
  const apart = (a: readonly number[], b: readonly number[]): number =>
    Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0));

  it('Given the route in a fixed frame, Then it is a ring about Earth', () => {
    const [route] = craftRoutes([webb], wheres, turningSun, shown, followed);
    const xs = (route?.points ?? []).flatMap((point) => (point === null ? [] : [point[0]]));
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(2.9e6);
  });

  it('Given the route turning with the Sun, Then every point is at L2 as it is now', () => {
    const [route] = craftRoutes([webb], wheres, turningSun, shown, { ...followed, turning: true });
    const l2 = along(shown, -1.5e6);
    for (const point of route?.points ?? []) {
      if (point !== null) expect(apart(point, l2)).toBeLessThan(10_000);
    }
  });

  it('Given its trail turning too, Then the dot and the trail meet', () => {
    const [now] = craftNow([webb], wheres, turningSun, shown, { ...followed, turning: true });
    expect(now?.trail.length).toBeGreaterThan(0);
    expect(apart(now?.km ?? [], now?.trail[0] ?? [])).toBeLessThan(10_000);
  });

  it('Given no place for the Sun yet, Then the route is drawn as it is, unturned', () => {
    const noSun: Geocentric = () => null;
    const [route] = craftRoutes([webb], wheres, noSun, shown, { ...followed, turning: true });
    const [fixed] = craftRoutes([webb], wheres, noSun, shown, followed);
    expect(route?.points).toEqual(fixed?.points);
  });
});
