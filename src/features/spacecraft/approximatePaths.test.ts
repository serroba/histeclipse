import { describe, expect, it } from 'vitest';

import paths from '../../../public/data/spacecraft-paths.json';
import record from '../../../public/data/spacecraft.json';
import { loadMoonEphemeris } from '../../astro/moon';
import { loadPlanetEphemeris, PLANETS } from '../../astro/planets';
import { sunPositionJ2000 } from '../../astro/precession';
import type { JulianDay } from '../../time/julianDay';
import { gcatJd, type Craft, type CraftPhase } from '../../data/spacecraft';
import type { CraftWhere } from '../../data/spacecraftPaths';
import { approximatePath, ECLIPTIC_POLE, turned, type Geocentric } from './approximatePaths';
import type { Vec3 } from '../../astro/transfer';

const AU = 149_597_870.7;
const START = gcatJd('2000-01-01');

/** A made-up solar system: circles in the ecliptic about the Sun, and the Moon about Earth. */
function circle(radius: number, days: number, jd: number, phase = 0): Vec3 {
  const angle = phase + (2 * Math.PI * (jd - START)) / days;
  return turned(
    [radius * Math.cos(angle), radius * Math.sin(angle), 0],
    [1, 0, 0],
    -Math.acos(ECLIPTIC_POLE[2]),
  );
}
const earth = (jd: number) => circle(AU, 365.25, jd);
const geocentric: Geocentric = (body, jd) => {
  const e = earth(jd);
  if (body === 'Sun') return [-e[0], -e[1], -e[2]];
  if (body === 'Moon') return circle(384_400, 27.32, jd);
  if (body === 'Mars') {
    const m = circle(1.524 * AU, 687, jd, 1);
    return [m[0] - e[0], m[1] - e[1], m[2] - e[2]];
  }
  return null;
};

function craft(phases: CraftPhase[]): Craft {
  return {
    id: 'D1',
    name: 'Probe',
    cospar: '2000-001A',
    nssdc: '2000-001A',
    launchTag: '2000-001',
    launch: '2000-01-01',
    owner: 'X',
    state: 'X',
    crewed: false,
    part: false,
    parent: null,
    phases,
  };
}

function km(where: CraftWhere | null): Vec3 {
  return where !== null && 'km' in where ? where.km : [NaN, NaN, NaN];
}
const apart = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('approximate paths, for craft whose trajectory nobody published', () => {
  it('Given GCAT dates, Then a month means its middle and a year its middle too', () => {
    expect(gcatJd('2000-01-01T12:00')).toBe(2_451_545);
    expect(gcatJd('2000-01?')).toBe(gcatJd('2000-01-15'));
    expect(gcatJd('2000')).toBe(gcatJd('2000-07-02'));
  });

  it('Given a probe to Mars, Then it leaves from Earth and arrives where Mars is, and stays at Mars', () => {
    const at = approximatePath(
      craft([
        ['Earth', '2000-01-01', '2000-01-03', 'EO', 'HCO'],
        ['Sun', '2000-01-03', '2000-09-18', 'EO', 'Mars'],
        ['Mars', '2000-09-18', null, 'O', '-'],
      ]),
      geocentric,
    );
    const left = gcatJd('2000-01-03');
    const arrived = gcatJd('2000-09-18');
    // Leaving: still at Earth, then about the Sun from where Earth was.
    expect(at(START + 1)).toEqual({ at: 'Earth' });
    expect(at(left)).toMatchObject({ centre: 'Sun' });
    expect(apart(km(at(left)), earth(left)) / AU).toBeLessThan(1e-6);
    const mars = geocentric('Mars', arrived - 1e-6);
    const sun = geocentric('Sun', arrived - 1e-6);
    const marsFromSun: Vec3 =
      mars !== null && sun !== null
        ? [mars[0] - sun[0], mars[1] - sun[1], mars[2] - sun[2]]
        : [0, 0, 0];
    expect(apart(km(at(arrived - 1e-6)), marsFromSun) / AU).toBeLessThan(1e-4);
    expect(at(arrived + 10)).toEqual({ at: 'Mars' });
  });

  it('Given a flight to the Moon and back, Then it leaves from a parking orbit, meets the Moon, and comes home', () => {
    const at = approximatePath(
      craft([
        ['Earth', '2000-01-01', '2000-01-04', 'EAO', 'Luna'],
        ['Luna', '2000-01-04', '2000-01-06', 'EAO', 'Earth'],
        ['Earth', '2000-01-06', '2000-01-09', 'R', '-'],
      ]),
      geocentric,
    );
    expect(Math.hypot(...km(at(START)))).toBeCloseTo(6678, 0);
    const met = gcatJd('2000-01-04') - 1e-6;
    expect(apart(km(at(met)), circle(384_400, 27.32, met))).toBeLessThan(10);
    expect(at(gcatJd('2000-01-05'))).toEqual({ at: 'Luna' });
    expect(Math.hypot(...km(at(gcatJd('2000-01-09') - 1e-6)))).toBeCloseTo(6478, -1);
  });

  it('Given a leg from a world back to the same world, Then it is not drawn as one transfer', () => {
    const at = approximatePath(
      craft([
        ['Earth', '2000-01-01', '2000-01-03', 'EO', 'HCO'],
        ['Sun', '2000-01-03', '2001-01-10', 'EO', 'Earth'],
        ['Earth', '2001-01-10', '2001-01-12', 'EO', 'HCO'],
      ]),
      geocentric,
    );
    expect(at(gcatJd('2000-07-01'))).toBeNull();
  });

  it('Given an observatory at L1, Then it is 1.5 million km sunward', () => {
    const at = approximatePath(craft([['SEL1', '2000-01-01', null, 'O', '-']]), geocentric);
    const where = km(at(START + 100));
    const sun = geocentric('Sun', START + 100) ?? [0, 0, 0];
    expect(where[0] * sun[0] + where[1] * sun[1] + where[2] * sun[2]).toBeGreaterThan(0);
  });

  it('Given no ephemeris to place the Sun or the Moon, Then nothing is made up', () => {
    const nowhere: Geocentric = () => null;
    const phases: CraftPhase[] = [
      ['Earth', '2000-01-01', '2000-01-04', 'EAO', 'Luna'],
      ['Luna', '2000-01-04', '2000-01-06', 'EAO', 'Earth'],
      ['Earth', '2000-01-06', '2000-01-09', 'R', '-'],
      ['Sun', '2000-01-09', '2000-06-01', 'EO', 'Mars'],
      ['SEL1', '2000-06-01', null, 'O', '-'],
    ];
    const at = approximatePath(craft(phases), nowhere);
    expect(at(START + 1)).toEqual({ at: 'Earth' });
    expect(at(gcatJd('2000-01-07'))).toEqual({ at: 'Earth' });
    expect(at(gcatJd('2000-03-01'))).toBeNull();
    expect(at(gcatJd('2000-07-01'))).toBeNull();
  });

  it('Given legs it cannot draw, Then they are nowhere: no start, no end, no time, no world', () => {
    const at = approximatePath(
      craft([
        ['Sun', '2000-01-01', '2000-02-01', 'EO', 'Mars'],
        ['Sun', '2000-02-01', null, 'O', '-'],
      ]),
      geocentric,
    );
    // No world it left from; then open-ended about the Sun.
    expect(at(gcatJd('2000-01-15'))).toBeNull();
    expect(at(gcatJd('2000-06-01'))).toBeNull();
    // A minute to Mars: no orbit gets there so fast.
    const rushed = approximatePath(
      craft([
        ['Earth', '2000-01-01', '2000-01-02', 'EO', 'HCO'],
        ['Sun', '2000-01-02T00:00', '2000-01-02T00:01', 'EO', 'Mars'],
      ]),
      geocentric,
    );
    expect(rushed(gcatJd('2000-01-02T00:00') + 1e-5)).toBeNull();
    // A comet's coma, and a phase with no start.
    const odd = approximatePath(
      craft([
        ['67P/', '2000-01-01', '2000-02-01', 'O', '-'],
        ['Earth', null, '2000-03-01', 'O', '-'],
      ]),
      geocentric,
    );
    expect(odd(gcatJd('2000-01-15'))).toBeNull();
    expect(odd(gcatJd('2000-02-15'))).toBeNull();
  });

  it('Given an observatory at L2, Then it is 1.5 million km beyond Earth from the Sun', () => {
    const at = approximatePath(craft([['SEL2', '2000-01-01', null, 'O', '-']]), geocentric);
    const where = km(at(START + 100));
    const sun = geocentric('Sun', START + 100) ?? [0, 0, 0];
    expect(Math.hypot(...where)).toBeCloseTo(1.5e6, -3);
    expect(where[0] * sun[0] + where[1] * sun[1] + where[2] * sun[2]).toBeLessThan(0);
  });

  it('Given a craft that leaves the Moon for L2, Then it flies out to L2, not back to Earth (#790)', () => {
    const left = gcatJd('2000-03-01');
    const arrived = gcatJd('2000-05-15');
    const at = approximatePath(
      craft([
        ['Luna', '2000-01-10', '2000-03-01', 'O', 'Luna'],
        ['Earth', '2000-03-01', '2000-05-15', 'EO', 'SEL2'],
        ['SEL2', '2000-05-15', null, 'O', '-'],
      ]),
      geocentric,
    );
    expect(apart(km(at(left)), geocentric('Moon', left) ?? [0, 0, 0])).toBeLessThan(1);
    // It arrives where it then stays, and is never nearer Earth than the Moon it left.
    expect(apart(km(at(arrived - 1e-6)), km(at(arrived)))).toBeLessThan(100);
    for (let jd = left; jd < arrived; jd += 0.5) {
      const from = Math.hypot(...km(at(jd)));
      expect(from).toBeGreaterThan(380_000);
      expect(from).toBeLessThan(2e6);
    }
  });

  it('Given a craft launched for L2, Then it flies out from Earth to L2 in its weeks, rather than staying at Earth (#813)', () => {
    const left = gcatJd('2000-03-01');
    const arrived = gcatJd('2000-03-31');
    const at = approximatePath(
      craft([
        ['Earth', '2000-03-01', '2000-03-31', 'EO', 'SEL2'],
        ['SEL2', '2000-03-31', null, 'O', '-'],
      ]),
      geocentric,
    );
    expect(Math.hypot(...km(at(left)))).toBeLessThan(7000);
    const midway = Math.hypot(...km(at((left + arrived) / 2)));
    expect(midway).toBeGreaterThan(300_000);
    expect(midway).toBeLessThan(1.6e6);
    // It reaches the point itself, to stay there.
    expect(apart(km(at(arrived - 1e-6)), km(at(arrived)))).toBeLessThan(1000);
    // And a point it cannot place by, with no Sun, is nowhere rather than made up.
    expect(
      approximatePath(
        craft([['Earth', '2000-03-01', '2000-03-31', 'EO', 'SEL1']]),
        () => null,
      )(left + 1),
    ).toEqual({ at: 'Earth' });
  });

  it('Given months in Earth orbit between two meetings with the Moon, Then it is at Earth, not on one long transfer (#791)', () => {
    const phases = (back: string): CraftPhase[] => [
      ['Luna', '2000-01-10', '2000-03-01', 'EN', 'Luna'],
      ['Earth', '2000-03-01', back, 'EO', 'Luna'],
      ['Luna', back, null, 'O', '-'],
    ];
    // Eighty days as one transfer would swing out past a million km; four days is a flight.
    expect(approximatePath(craft(phases('2000-05-20')), geocentric)(gcatJd('2000-04-01'))).toEqual({
      at: 'Earth',
    });
    const short = approximatePath(craft(phases('2000-03-05')), geocentric)(gcatJd('2000-03-03'));
    expect(Math.hypot(...km(short))).toBeLessThan(450_000);
  });

  it('Given a craft that leaves the Moon for L1 with no Sun to place it by, Then it is not drawn', () => {
    const moonOnly: Geocentric = (body, jd) => (body === 'Moon' ? geocentric(body, jd) : null);
    const at = approximatePath(
      craft([
        ['Luna', '2000-01-10', '2000-03-01', 'O', 'Luna'],
        ['Earth', '2000-03-01', '2000-05-15', 'EO', 'SEL1'],
      ]),
      moonOnly,
    );
    expect(at(gcatJd('2000-04-01'))).toEqual({ at: 'Earth' });
  });

  it('Given a leg to a world the site cannot place, or a time outside the record, Then it is nowhere', () => {
    const at = approximatePath(
      craft([
        ['Earth', '2000-01-01', '2000-01-03', 'EO', 'HCO'],
        ['Sun', '2000-01-03', '2000-06-01', 'EO', '1P/Halley'],
      ]),
      geocentric,
    );
    expect(at(gcatJd('2000-03-01'))).toBeNull();
    expect(at(START - 10)).toBeNull();
  });
});

describe('every craft the site draws an approximate path for', () => {
  it('Given its whole flight, Then it is never outside the solar system, nor faster than any craft has flown (#790)', async () => {
    const moon = await loadMoonEphemeris();
    const planets = await loadPlanetEphemeris();
    const real: Geocentric = (body, jd) => {
      if (body === 'Sun') return sunPositionJ2000(jd as JulianDay);
      if (body === 'Moon') return moon.position(jd as JulianDay);
      const planet = PLANETS.find((name) => name === body.toLowerCase());
      return planet === undefined ? null : planets.position(planet, jd as JulianDay);
    };
    const published: Readonly<Record<string, unknown>> = paths.paths;
    // About Earth, 2 million km: a little past the L points, and no long loops out of Earth's
    // reach (#791). About the Sun, a little past Saturn. And 100 km/s between moments, which
    // no craft has reached. The line across the view in #790 was 10¹³ AU long.
    const FURTHEST = { Earth: 2e6, Sun: 11 * AU };
    const MOMENTS = 60;
    const wrong: string[] = [];
    let drawn = 0;
    for (const each of record.craft as Craft[]) {
      if (published[each.id] !== undefined) continue;
      const at = approximatePath(each, real);
      each.phases.forEach(([, began, ended], index) => {
        if (began === null || ended === null) return;
        const start = gcatJd(began);
        const step = (gcatJd(ended) - start) / MOMENTS;
        // A phase GCAT gives no length to (an impact on the day of arrival) has no flight.
        if (step <= 0) return;
        let before: Vec3 | null = null;
        for (let k = 0; k < MOMENTS; k += 1) {
          const where = at(start + (k + 0.5) * step);
          if (where === null || 'at' in where) {
            before = null;
            continue;
          }
          drawn += 1;
          const from = Math.hypot(...where.km);
          const speed = before === null ? 0 : apart(where.km, before) / (step * 86_400);
          if (!(from < FURTHEST[where.centre]) || !(speed < 100)) {
            wrong.push(`${each.id} ${each.name}, phase ${String(index)}`);
          }
          before = where.km;
        }
      });
    }
    expect(drawn).toBeGreaterThan(5000);
    expect([...new Set(wrong)]).toEqual([]);
  });
});
