/**
 * Approximate paths for the craft nobody published a trajectory for (#350): the early Luna,
 * Venera and Mars probes, Ranger and Surveyor, Viking, Apollo, Chang'e. Each phase of a craft's
 * record (GCAT) says where it was and when: about the Sun between leaving one world and reaching
 * the next; about Earth on the way to or from the Moon; at a world in orbit, landed or passing.
 *
 * - Between worlds about the Sun: the transfer orbit from where the world it left was when it
 *   left, to where the world it reached was when it arrived (Lambert's problem), prograde.
 * - To the Moon: the transfer about Earth from a parking orbit (6,678 km from Earth's centre,
 *   170° round from where it met the Moon, as a translunar arc is) to the Moon on arrival; and
 *   back, from the Moon on leaving to 6,478 km on reaching Earth; past the Moon and out about
 *   the Sun (Luna 1, Pioneer 4), nowhere, not as a fall back to Earth (#793). From the Moon out
 *   to the Sun-Earth L1 or L2 point (Chang'e 2, #790): the transfer to where that point is on
 *   arrival.
 *   A leg about Earth that would swing far out past both its ends (weeks or years in Earth
 *   orbit between meetings with the Moon: Geotail, Hiten, SMART-1) is laps about Earth, which
 *   one transfer cannot follow: the craft is at Earth, and not drawn (#791).
 * - From Earth out to the Sun-Earth L1 or L2 point (JWST, Herschel, #813): the same, from the
 *   parking orbit to where the point is on arrival.
 * - At the Sun-Earth L1 or L2 point: 1.5 million km sunward or away.
 * - At a world (the Moon, a planet): there. Elsewhere (a comet, an asteroid, a leg with no
 *   world the site can place): nowhere, rather than somewhere made up. Nor a leg from a world
 *   back to the same one (Earth to Earth for a gravity assist, Mariner 10 from Mercury to
 *   Mercury): that is a lap or more about the Sun, which one transfer orbit cannot follow; nor a
 *   transfer between worlds that swings far out past both (Magellan's 1.5 laps to Venus, #793).
 *
 * Against JPL Horizons, for craft both have, a direct transfer (to Mars, to Venus) comes
 * within about 0.02 AU of where the craft was at mid-cruise; a cruise of several laps and
 * gravity assists (MESSENGER, Parker) would be AUs off, and for those the site uses Horizons.
 *
 * These are the paths as first planned, not as flown: drawn, they are marked approximate.
 */

import { gcatJd, type Craft } from '../../data/spacecraft';
import { elementAt } from '../../util/arrays';
import type { CraftWhere } from '../../data/spacecraftPaths';
import { GM_EARTH, GM_SUN, lambert, propagate, type Vec3 } from '../../astro/transfer';

/** Where a body is from Earth's centre at a moment (TT), J2000 km; null if not known. */
export type Geocentric = (body: string, jdTT: number) => Vec3 | null;

/** The bodies the site can place, as GCAT names them, and as the site does. */
const PLACED: Readonly<Record<string, string>> = {
  Sun: 'Sun',
  Luna: 'Moon',
  Mercury: 'Mercury',
  Venus: 'Venus',
  Mars: 'Mars',
  Jupiter: 'Jupiter',
  Saturn: 'Saturn',
};
const WORLDS = new Set(['Luna', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']);
const PARKING_KM = 6678;
const ENTRY_KM = 6478;
/** Longest flight out to an L point that one direct transfer follows, days (#813). */
const DIRECT_DAYS = 45;
const L_POINT_KM = 1.5e6;
const TRANSLUNAR = (170 * Math.PI) / 180;
/**
 * A transfer goes from one place to another. One that swings out past half as far again as the
 * farther of the two is not a transfer but laps: weeks about Earth (a craft kept in Earth orbit
 * between meetings with the Moon, #791), or a cruise of more than a lap about the Sun (Magellan
 * to Venus, Philae riding Rosetta, #793). One orbit cannot follow either. In the record, every
 * flight to or from the Moon of two weeks or less stays within it, and every one of sixteen
 * days or more does not.
 */
const FARTHEST = 1.5;
/** Moments along a transfer at which its distance from the centre is looked at. */
const MOMENTS = 32;
const OBLIQUITY = (23.439_291_1 * Math.PI) / 180;
/** The ecliptic's pole in J2000 equatorial axes: transfers go round it as the planets do. */
export const ECLIPTIC_POLE: Vec3 = [0, -Math.sin(OBLIQUITY), Math.cos(OBLIQUITY)];

function unit(a: Vec3): Vec3 {
  const n = Math.hypot(...a);
  return [a[0] / n, a[1] / n, a[2] / n];
}

/** Turn `a` by `angle` about the unit vector `axis` (Rodrigues). */
export function turned(a: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const d = a[0] * axis[0] + a[1] * axis[1] + a[2] * axis[2];
  const k: Vec3 = [
    axis[1] * a[2] - axis[2] * a[1],
    axis[2] * a[0] - axis[0] * a[2],
    axis[0] * a[1] - axis[1] * a[0],
  ];
  return [
    a[0] * c + k[0] * s + axis[0] * d * (1 - c),
    a[1] * c + k[1] * s + axis[1] * d * (1 - c),
    a[2] * c + k[2] * s + axis[2] * d * (1 - c),
  ];
}

const scaled = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];

interface Leg {
  readonly centre: 'Sun' | 'Earth';
  readonly start: number;
  readonly r1: Vec3;
  readonly v1: Vec3;
  readonly gm: number;
}

/** The Sun-Earth L1 or L2 point from Earth's centre: 1.5 million km sunward, or away. */
function lagrangePoint(geocentric: Geocentric, point: 'SEL1' | 'SEL2', jd: number): Vec3 | null {
  const sun = geocentric('Sun', jd);
  return sun === null ? null : scaled(unit(sun), point === 'SEL1' ? L_POINT_KM : -L_POINT_KM);
}

/** Where a craft leaving the Moon is bound: an L point, or 6,478 km from Earth's centre. */
function boundFromMoon(
  geocentric: Geocentric,
  after: string | undefined,
  moon: Vec3,
  end: number,
): Vec3 | null {
  return after === 'SEL1' || after === 'SEL2'
    ? lagrangePoint(geocentric, after, end)
    : scaled(turned(unit(moon), ECLIPTIC_POLE, TRANSLUNAR), ENTRY_KM);
}

/**
 * A leg about Earth, from `start` to `end`: out to the Moon from a parking orbit; back from it;
 * or straight out to the Sun-Earth L1 or L2 point in a month or so (JWST, Herschel, Planck,
 * ACE, #813), from a parking orbit to where the point is on arrival. Months on the way to a point
 * are loops and lunar passes one transfer cannot follow.
 */
function earthLeg(
  geocentric: Geocentric,
  before: string | undefined,
  after: string | undefined,
  start: number,
  end: number,
): Leg | null {
  if (after === 'Luna') {
    const moon = geocentric('Moon', end);
    if (moon === null) return null;
    const r1 = scaled(turned(unit(moon), ECLIPTIC_POLE, -TRANSLUNAR), PARKING_KM);
    return solved('Earth', start, end, r1, moon, GM_EARTH);
  }
  if (before === 'Luna') {
    // Past the Moon and on out about the Sun (Luna 1, Pioneer 4, Snoopy): not a return, and no
    // transfer from the Moon to Earth's sphere's edge is known to draw (#793).
    if (after === 'Sun') return null;
    const moon = geocentric('Moon', start);
    if (moon === null) return null;
    return solved('Earth', start, end, moon, boundFromMoon(geocentric, after, moon, end), GM_EARTH);
  }
  if ((after === 'SEL1' || after === 'SEL2') && end - start <= DIRECT_DAYS) {
    const point = lagrangePoint(geocentric, after, end);
    if (point === null) return null;
    const r1 = scaled(turned(unit(point), ECLIPTIC_POLE, -TRANSLUNAR), PARKING_KM);
    return solved('Earth', start, end, r1, point, GM_EARTH);
  }
  return null;
}

/**
 * The approximate path of a craft: where it was at a moment (TT), about the Sun or Earth, or at
 * a world; null where its record cannot place it. Each leg's orbit is worked out once.
 */
export function approximatePath(
  craft: Craft,
  geocentric: Geocentric,
): (jdTT: number) => CraftWhere | null {
  const { phases } = craft;
  const legs = new Map<number, Leg | null>();

  /** Where a body the site places is from the Sun, J2000 km. */
  function heliocentric(body: string, jd: number): Vec3 | null {
    const sun = geocentric('Sun', jd);
    if (sun === null) return null;
    if (body === 'Earth') return scaled(sun, -1);
    const name = PLACED[body];
    const there = name === undefined ? null : geocentric(name, jd);
    return there === null ? null : [there[0] - sun[0], there[1] - sun[1], there[2] - sun[2]];
  }

  function leg(index: number): Leg | null {
    const known = legs.get(index);
    if (known !== undefined) return known;
    const made = makeLeg(index);
    legs.set(index, made);
    return made;
  }

  function makeLeg(index: number): Leg | null {
    const [body, began, ended, , dest] = elementAt(phases, index);
    if (began === null || ended === null) return null;
    const start = gcatJd(began);
    const end = gcatJd(ended);
    const before = phases[index - 1]?.[0];
    const after = phases[index + 1]?.[0] ?? dest;
    if (body === 'Sun') {
      if (before === after) return null;
      const r1 = before === undefined ? null : heliocentric(before, start);
      const r2 = heliocentric(after, end);
      return solved('Sun', start, end, r1, r2, GM_SUN);
    }
    return body === 'Earth' ? earthLeg(geocentric, before, after, start, end) : null;
  }

  // Each phase's span as numbers, read once rather than at every moment asked (#767).
  const spans = phases.map(([, began, ended]): readonly [number, number] => [
    began === null ? Infinity : gcatJd(began),
    ended === null ? Infinity : gcatJd(ended),
  ]);
  return (jdTT) => {
    const index = spans.findIndex(([began, ended]) => {
      return began <= jdTT && jdTT < ended;
    });
    const phase = phases[index];
    if (phase === undefined) return null;
    const [body] = phase;
    if (WORLDS.has(body)) return { at: body };
    if (body === 'SEL1' || body === 'SEL2') {
      const km = lagrangePoint(geocentric, body, jdTT);
      return km === null ? null : { centre: 'Earth', km };
    }
    const path = leg(index);
    if (path === null) return body === 'Earth' ? { at: 'Earth' } : null;
    const km = propagate(path.r1, path.v1, (jdTT - path.start) * 86_400, path.gm);
    return { centre: path.centre, km };
  };
}

/** Whether a transfer goes out past `FARTHEST` times the farther of its two ends on the way. */
function swingsOut(leg: Leg, r2: Vec3, seconds: number): boolean {
  const reach = FARTHEST * Math.max(Math.hypot(...leg.r1), Math.hypot(...r2));
  for (let k = 1; k < MOMENTS; k += 1) {
    const there = propagate(leg.r1, leg.v1, (k / MOMENTS) * seconds, leg.gm);
    if (Math.hypot(...there) > reach) return true;
  }
  return false;
}

function solved(
  centre: 'Sun' | 'Earth',
  start: number,
  end: number,
  r1: Vec3 | null,
  r2: Vec3 | null,
  gm: number,
): Leg | null {
  if (r1 === null || r2 === null || end <= start) return null;
  const seconds = (end - start) * 86_400;
  const found = lambert(r1, r2, seconds, gm, ECLIPTIC_POLE);
  if (found === null) return null;
  const leg: Leg = { centre, start, r1, v1: found.v1, gm };
  return swingsOut(leg, r2, seconds) ? null : leg;
}
