import { describe, expect, it } from 'vitest';

import type { Craft, CraftPhase } from '../data/spacecraft';
import type { CraftWhere } from '../data/spacecraftPaths';
import {
  approximatePath,
  ECLIPTIC_POLE,
  gcatJd,
  turned,
  type Geocentric,
} from './approximatePaths';
import type { Vec3 } from './transfer';

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
