/**
 * Where the craft beyond Earth orbit were at a moment (#350): each in flight then, from Earth's
 * centre (J2000 km), with a trail of where it had just been. Its path is JPL Horizons's where
 * Horizons has it, else its approximate path (`approximatePaths.ts`); a craft at a world (in
 * orbit, landed, passing) is at that world. A craft still about Earth after launch, or one no
 * path places at that moment, is left out.
 */

import { gcatJd, type Craft } from '../../data/spacecraft';
import { craftAt, type CraftPaths, type CraftWhere } from '../../data/spacecraftPaths';
import { approximatePath, type Geocentric } from './approximatePaths';
import type { Vec3 } from '../../astro/transfer';

export interface CraftNow {
  readonly id: string;
  readonly name: string;
  /** From Earth's centre, J2000 km. */
  readonly km: Vec3;
  /** Where it had been, newest first, from Earth's centre then (J2000 km). */
  readonly trail: readonly Vec3[];
  /** Drawn on its approximate path, not on a published trajectory. */
  readonly approximate: boolean;
  /** At a world (the Moon, a planet) rather than on its way. */
  readonly at: string | null;
}

/** A craft's whole route through a mission followed (#712). */
export interface CraftRoute {
  readonly id: string;
  /** Oldest first, from Earth's centre (J2000 km); null where its path does not place it,
   * breaking the line. */
  readonly points: readonly (Vec3 | null)[];
  readonly approximate: boolean;
}

/** How a mission followed is drawn (#712). */
export interface Followed {
  /** From leaving Earth to its last moment, TT (as near as a minute is to UT). */
  readonly from: number;
  readonly to: number;
  /** Never about the Sun: every point drawn about Earth as it was then, the Moon where it was
   * from Earth, rather than among the planets as seen from Earth now. */
  readonly aboutEarth: boolean;
}

/** Points along a followed craft's route. */
const ROUTE_POINTS = 240;

/** Points in a trail, and how far back it reaches, days: about the Sun, and near Earth. */
const TRAIL_POINTS = 24;
const TRAIL_DAYS_FAR = 60;
const TRAIL_DAYS_NEAR = 2;

/** The site's names for the worlds GCAT names, where it can place them. */
const WORLD_NAMES: Readonly<Record<string, string>> = {
  Luna: 'Moon',
  Mercury: 'Mercury',
  Venus: 'Venus',
  Mars: 'Mars',
  Jupiter: 'Jupiter',
  Saturn: 'Saturn',
};

export interface CraftWheres {
  /** Where each craft is at a moment: Horizons's path, or its approximate one. */
  readonly where: (craft: Craft, jdTT: number) => CraftWhere | null;
  readonly approximate: (craft: Craft) => boolean;
}

/** Each craft's path, Horizons's where it has it, its approximate one worked out once if not. */
export function craftWheres(paths: CraftPaths, geocentric: Geocentric): CraftWheres {
  const approximate = new Map<string, ReturnType<typeof approximatePath>>();
  return {
    where(craft, jdTT) {
      const published = paths[craft.id];
      if (published !== undefined) return craftAt(published, jdTT);
      let path = approximate.get(craft.id);
      if (path === undefined) {
        path = approximatePath(craft, geocentric);
        approximate.set(craft.id, path);
      }
      return path(jdTT);
    },
    approximate: (craft) => paths[craft.id] === undefined,
  };
}

/**
 * A path's position at `jdTT` from Earth's centre at `nowTT` (J2000 km): about Earth as it
 * is; about the Sun, or at a world, where it was among the planets, seen from where Earth is
 * now. So a trail stays where the craft went, not where Earth has since carried it.
 */
export function fromEarth(
  where: CraftWhere,
  jdTT: number,
  geocentric: Geocentric,
  nowTT = jdTT,
): Vec3 | null {
  if ('centre' in where && where.centre === 'Earth') return where.km;
  const sunThen = geocentric('Sun', jdTT);
  const sunNow = geocentric('Sun', nowTT);
  if (sunThen === null || sunNow === null) return null;
  let fromSun: Vec3;
  if ('at' in where) {
    const name = WORLD_NAMES[where.at];
    const world = name === undefined ? null : geocentric(name, jdTT);
    if (world === null) return null;
    fromSun = [world[0] - sunThen[0], world[1] - sunThen[1], world[2] - sunThen[2]];
  } else {
    fromSun = where.km;
  }
  return [fromSun[0] + sunNow[0], fromSun[1] + sunNow[1], fromSun[2] + sunNow[2]];
}

/** Whether a craft's record has it in flight at a moment: launched, and not yet ended. */
export function inFlight(craft: Craft, jdTT: number): boolean {
  const first = craft.phases[0];
  const last = craft.phases.at(-1);
  if (first === undefined || last === undefined || first[1] === null) return false;
  return gcatJd(first[1]) <= jdTT && (last[2] === null || jdTT < gcatJd(last[2]));
}

/** Most places kept by `remembered`: a few seconds' play of trails, at any pace. */
const MOST_REMEMBERED = 4096;

/**
 * Where the bodies are, each body at each moment worked out once and kept (#702): the craft's
 * trails reach back to the same moments, on a grid of days, so a hundred craft in flight, frame
 * after frame, ask for only a few new places. A place not yet known (the planets still loading)
 * is asked again; past the most kept, all are let go and kept anew.
 */
export function remembered(geocentric: Geocentric, most = MOST_REMEMBERED): Geocentric {
  const known = new Map<string, Vec3>();
  return (body, jdTT) => {
    const key = `${body} ${String(jdTT)}`;
    const kept = known.get(key);
    if (kept !== undefined) return kept;
    const where = geocentric(body, jdTT);
    if (where === null) return null;
    if (known.size >= most) known.clear();
    known.set(key, where);
    return where;
  };
}

/**
 * The moments a trail reaches back to from `jdTT`, newest first: on a grid of whole steps, so
 * they are the same moments frame after frame, and the bodies' places at them are kept.
 */
export function trailMoments(jdTT: number, step: number): readonly number[] {
  const newest = Math.ceil(jdTT / step) - 1;
  return Array.from({ length: TRAIL_POINTS }, (_, k) => (newest - k) * step);
}

/**
 * Each craft's whole route through a mission followed, seen at `jdTT`: at the same moments
 * every frame, so the bodies' places along it are kept.
 */
export function craftRoutes(
  craft: readonly Craft[],
  wheres: CraftWheres,
  geocentric: Geocentric,
  jdTT: number,
  followed: Followed,
): readonly CraftRoute[] {
  const { from, to, aboutEarth } = followed;
  return craft.map((each) => ({
    id: each.id,
    approximate: wheres.approximate(each),
    points: Array.from({ length: ROUTE_POINTS + 1 }, (_, k) => {
      const then = from + ((to - from) * k) / ROUTE_POINTS;
      const where = wheres.where(each, then);
      if (where === null || ('at' in where && where.at === 'Earth')) return null;
      return fromEarth(where, then, geocentric, aboutEarth ? then : jdTT);
    }),
  }));
}

/** Where a craft had just been, newest first, back along its path from where it is now. */
function trailOf(
  craft: Craft,
  where: CraftWhere,
  wheres: CraftWheres,
  geocentric: Geocentric,
  jdTT: number,
  aboutEarth: boolean,
): Vec3[] {
  const near = 'centre' in where && where.centre === 'Earth';
  const step = (near ? TRAIL_DAYS_NEAR : TRAIL_DAYS_FAR) / TRAIL_POINTS;
  const trail: Vec3[] = [];
  for (const then of trailMoments(jdTT, step)) {
    const before = wheres.where(craft, then);
    const point =
      before === null ? null : fromEarth(before, then, geocentric, aboutEarth ? then : jdTT);
    if (point === null) break;
    trail.push(point);
  }
  return trail;
}

/**
 * The craft in flight at a moment, where each is, and where each had just been; following a
 * mission about Earth, each point about Earth as it was then.
 */
export function craftNow(
  craft: readonly Craft[],
  wheres: CraftWheres,
  geocentric: Geocentric,
  jdTT: number,
  followed: Followed | null = null,
): readonly CraftNow[] {
  const out: CraftNow[] = [];
  const aboutEarth = followed?.aboutEarth === true;
  for (const each of craft) {
    if (!inFlight(each, jdTT)) continue;
    const where = wheres.where(each, jdTT);
    if (where === null || ('at' in where && where.at === 'Earth')) continue;
    const km = fromEarth(where, jdTT, geocentric);
    if (km === null) continue;
    const trail = trailOf(each, where, wheres, geocentric, jdTT, aboutEarth);
    out.push({
      id: each.id,
      name: each.mission ?? each.name,
      km,
      trail,
      approximate: wheres.approximate(each),
      at: 'at' in where ? where.at : null,
    });
  }
  return out;
}
