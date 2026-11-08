/**
 * A cosmic ray's shower in the air, as the 3D story draws it (#317): a proton of a few GeV
 * strikes an air nucleus high up, and what it makes strikes others, a cascade down toward the
 * ground. Lengths are in km, the altitude up; x and z run across the ground.
 *
 * Where things happen comes from how much air lies above: the air's depth falls off with height
 * (an isothermal atmosphere, scale height 7 km), and a proton goes one interaction length of
 * air, 90.1 g/cm², between collisions, so the first comes about 17 km up and each after it
 * nearer the last as the air thickens. Gamma rays and electrons multiply every radiation length,
 * 36.6 g/cm². Only a few of the particles are drawn: an illustration of the cascade's shape.
 */

import { LIGHT_KM_S } from './sunlightJourney';
import { seeded } from './photonWalk';

export type Point = readonly [x: number, y: number, z: number];

/** The kinds of particle drawn, each in its own colour. */
export type Particle = 'proton' | 'neutron' | 'pion' | 'muon' | 'electromagnetic';

/** The air above sea level, g/cm²: 1013.25 hPa over standard gravity. */
export const SEA_LEVEL_DEPTH = 1033;
/** How fast the air thins with height: its depth falls by e every this many km. */
export const SCALE_HEIGHT_KM = 7;
/** How much air a proton crosses between collisions with its nuclei, g/cm² (PDG: air). */
export const INTERACTION_LENGTH = 90.1;
/** How much air a gamma ray or an electron crosses between its splittings, g/cm² (PDG: air). */
export const RADIATION_LENGTH = 36.62;
/** Where the drawing begins, km up: where the proton is seen coming in. */
export const TOP_KM = 30;
/** Where most carbon-14 is made, km up (the upper troposphere and lower stratosphere). */
export const MADE_KM: readonly [low: number, high: number] = [9, 15];
/** Collisions of the proton (and what leads on from it) drawn. */
const COLLISIONS = 4;
/** Splittings of the gamma rays and electrons drawn, from each collision. */
const SPLITTINGS = 3;

/** The air above `km`, g/cm². */
export function depthAt(km: number): number {
  return SEA_LEVEL_DEPTH * Math.exp(-km / SCALE_HEIGHT_KM);
}

/** How high the air above is `depth` g/cm², km. */
export function altitudeAt(depth: number): number {
  return SCALE_HEIGHT_KM * Math.log(SEA_LEVEL_DEPTH / depth);
}

/** How high a proton coming straight down first strikes the air, km: about 17. */
export const FIRST_COLLISION_KM = altitudeAt(INTERACTION_LENGTH);

/** How long light takes `km`, µs; the shower's front goes at nearly its speed. */
export function microseconds(km: number): number {
  return (km / LIGHT_KM_S) * 1e6;
}

/** One particle's track, and when it is drawn: from `start` to `end`, km the front has gone. */
export interface Track {
  readonly kind: Particle;
  readonly from: Point;
  readonly to: Point;
  /** How far the shower's front has gone from the first collision when it starts, km. */
  readonly start: number;
  readonly end: number;
}

export interface Cascade {
  readonly tracks: readonly Track[];
  /** Where the proton first strikes. */
  readonly first: Point;
  /** Each collision of the proton and what leads on from it, from the first down. */
  readonly collisions: readonly Point[];
  /** The neutron followed: born in a collision where carbon-14 is made, slowing as it goes. */
  readonly neutron: readonly Point[];
  /** How far the front goes before the last track ends, km. */
  readonly length: number;
}

const add = (a: Point, b: Point, scale = 1): Point => [
  a[0] + b[0] * scale,
  a[1] + b[1] * scale,
  a[2] + b[2] * scale,
];
const distance = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * The shower of a proton coming in at `slant` radians from straight down: its tracks, its
 * collisions, and the neutron followed. The same shower every time for one `seed`.
 */
export function airCascade(seed = 11, slant = 0.25): Cascade {
  const random = seeded(seed);
  const tracks: Track[] = [];
  const spread = (width: number): number => (random() * 2 - 1) * width;

  /** Which way down, `width` radians either side of `around`, at most 80° from straight down. */
  const downward = (around: Point, width: number): Point => {
    const tilt = Math.min(1.4, Math.acos(-around[1]) + spread(width));
    const turn = Math.atan2(around[2], around[0]) + spread(width * 2);
    return [Math.sin(tilt) * Math.cos(turn), -Math.cos(tilt), Math.sin(tilt) * Math.sin(turn)];
  };

  /**
   * Where a particle from `from` going `direction` has crossed `depth` g/cm² more air, or meets
   * the ground first.
   */
  const after = (from: Point, direction: Point, depth: number): Point => {
    const down = -direction[1];
    const deeper = depthAt(from[1]) + depth * down;
    const altitude = Math.max(0, deeper >= SEA_LEVEL_DEPTH ? 0 : altitudeAt(deeper));
    return add(from, direction, (from[1] - altitude) / down);
  };

  const track = (kind: Particle, from: Point, to: Point, start: number, slow = 1): number => {
    const end = start + distance(from, to) * slow;
    tracks.push({ kind, from, to, start, end });
    return end;
  };

  /** Gamma rays and electrons, each splitting in two every radiation length, `left` more times. */
  const electromagnetic = (from: Point, direction: Point, start: number, left: number): void => {
    const to = after(from, direction, RADIATION_LENGTH);
    const end = track('electromagnetic', from, to, start);
    if (left === 0 || to[1] <= 0) return;
    for (let i = 0; i < 2; i += 1) electromagnetic(to, downward(direction, 0.2), end, left - 1);
  };

  // The proton, in from the top.
  const inward: Point = [Math.sin(slant), -Math.cos(slant), 0];
  const firstAt: Point = [0, FIRST_COLLISION_KM, 0];
  const enters = add(firstAt, inward, -(TOP_KM - FIRST_COLLISION_KM) / Math.cos(slant));
  track('proton', enters, firstAt, -distance(enters, firstAt));

  const collisions: Point[] = [firstAt];
  let neutron: Point[] = [];
  let at = firstAt;
  let going = inward;
  let time = 0;
  for (let n = 0; n < COLLISIONS; n += 1) {
    // Charged pions, which become muons that reach the ground.
    for (let i = 0; i < 2; i += 1) {
      const direction = downward(going, 0.3);
      const decays = after(at, direction, INTERACTION_LENGTH * 0.6);
      const end = track('pion', at, decays, time);
      if (decays[1] > 0) track('muon', decays, after(decays, direction, SEA_LEVEL_DEPTH), end);
    }
    // A neutral pion, at once two gamma rays, each the start of a cascade of its own.
    for (let i = 0; i < 2; i += 1) {
      electromagnetic(at, downward(going, 0.35), time, SPLITTINGS - 1);
    }
    // Neutrons knocked out of the nucleus struck, slow, every which way.
    for (let i = 0; i < 2; i += 1) {
      const direction = downward([0, -1, 0], 1.1);
      track('neutron', at, add(at, direction, 1 + random() * 1.5), time, 3);
    }
    // The neutron followed, from the collision where most carbon-14 is made.
    if (neutron.length === 0 && at[1] <= MADE_KM[1] && at[1] >= MADE_KM[0]) {
      neutron = slowing(at, random);
    }
    // What leads on, to strike again deeper down.
    if (n === COLLISIONS - 1) break;
    going = downward(going, 0.08);
    const next = after(at, going, INTERACTION_LENGTH);
    time = track(n % 2 === 0 ? 'neutron' : 'proton', at, next, time);
    at = next;
    collisions.push(at);
  }

  const length = Math.max(...tracks.map(({ end }) => end));
  return { tracks, first: firstAt, collisions, neutron, length };
}

/** A neutron slowing down by bumping into air nuclei: a random walk of shortening steps. */
function slowing(from: Point, random: () => number): Point[] {
  const points: Point[] = [from];
  let at = from;
  for (let i = 0; i < 24; i += 1) {
    const z = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const across = Math.sqrt(1 - z * z);
    const step = 0.9 * 0.93 ** i;
    at = add(at, [across * Math.cos(angle), z * 0.6 - 0.1, across * Math.sin(angle)], step);
    points.push(at);
  }
  return points;
}

/** A short piece of a track, to draw the shower as its front goes down. */
export interface Piece {
  readonly kind: Particle;
  readonly from: Point;
  readonly to: Point;
  /** When the piece is reached, km the front has gone. */
  readonly at: number;
}

/** The tracks cut into pieces about `length` km long, in the order the front reaches them. */
export function pieces(tracks: readonly Track[], length = 0.25): Piece[] {
  const out: Piece[] = [];
  for (const { kind, from, to, start, end } of tracks) {
    const count = Math.max(1, Math.ceil(distance(from, to) / length));
    for (let i = 0; i < count; i += 1) {
      const a = i / count;
      const b = (i + 1) / count;
      out.push({
        kind,
        from: add(from, [to[0] - from[0], to[1] - from[1], to[2] - from[2]], a),
        to: add(from, [to[0] - from[0], to[1] - from[1], to[2] - from[2]], b),
        at: start + (end - start) * a,
      });
    }
  }
  return out.sort((p, q) => p.at - q.at);
}

/** How many of the pieces, in order, the front has reached when it has gone `km`. */
export function reached(drawn: readonly Piece[], km: number): number {
  let low = 0;
  let high = drawn.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((drawn[middle]?.at ?? Infinity) <= km) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** The particles, as the legend beside the shower names them. */
export const PARTICLES: readonly {
  readonly kind: Particle;
  readonly name: string;
  readonly about: string;
}[] = [
  { kind: 'proton', name: 'Proton', about: 'the cosmic ray, and the protons it knocks on' },
  {
    kind: 'neutron',
    name: 'Neutrons',
    about: 'knocked out of air nuclei; slowed by bumping into more, they make the carbon-14',
  },
  { kind: 'pion', name: 'Pions π', about: 'made in each collision, short-lived' },
  { kind: 'muon', name: 'Muons μ', about: 'what the charged pions become; most reach the ground' },
  {
    kind: 'electromagnetic',
    name: 'Gamma rays and electrons',
    about: 'from the neutral pions, doubling every radiation length',
  },
];

/** The facts written beside the shower. */
export const SHOWER_FACTS: readonly string[] = [
  `First collision about ${String(Math.round(FIRST_COLLISION_KM))} km up, after one interaction length of air, ${String(INTERACTION_LENGTH)} g/cm²`,
  `Its front reaches the ground some ${String(Math.round(microseconds(FIRST_COLLISION_KM)))} µs later, at nearly the speed of light`,
  `Most carbon-14 is made ${String(MADE_KM[0])}–${String(MADE_KM[1])} km up`,
  'Only a few of its particles drawn',
];
