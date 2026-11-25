/**
 * The disc round the growing Earth (#1219), as the formation clock draws it before Theia comes in:
 * the gas and dust of the Sun's disc, and the pebbles, planetesimals and embryos Earth sweeps up.
 *
 * Seen from the proto-Earth as it orbits the Sun, the material in its feeding zone streams past:
 * what orbits nearer the Sun goes ahead, what orbits further out falls behind (Keplerian shear,
 * the flow `−1.5 Ω x` along the orbit at `x` out from Earth's). The gas thins away by about
 * 4 million years (Wang et al. 2017); the swarm thins as Earth sweeps it up, as fast as the chosen
 * model has Earth growing. Sizes and counts are illustration: the pieces are drawn hundreds of
 * times their size, and the flow follows the time played, not the years.
 *
 * In Earth radii, in the disc's plane: x out from the Sun, z along the orbit, y off the plane.
 *
 * Pure.
 */

import { earthMass, PROTO_EARTH, type GrowthModel } from '../../deepTime/growth';

type Triple = readonly [number, number, number];

/** How far the swarm reaches either way, Earth radii. */
export const REACH = 14;
/** The flow's pace, radians of orbit a second of play: slow enough to follow. */
const FLOW = 0.04;

/** A piece of the swarm: where it is in the flow, and what it is. */
export interface Mote {
  /** Out from Earth's orbit (towards the Sun negative). */
  readonly x: number;
  /** Along the orbit when play starts. */
  readonly z: number;
  readonly y: number;
  /** A pebble or dust, a planetesimal, or an embryo. */
  readonly kind: 'dust' | 'planetesimal' | 'embryo';
  /** Swept up when Earth has grown past this share of the proto-Earth. */
  readonly sweptAt: number;
}

/** A number from 0 to 1 for `index` and `salt`, the same each time. */
function hash(index: number, salt: number): number {
  let h = Math.imul(index + 11, 0x9e3779b1) ^ Math.imul(salt + 3, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4_294_967_296;
}

/** The swarm: `count` pieces, nine in ten dust, a few embryos; none on Earth itself. */
export function motes(count: number): readonly Mote[] {
  return Array.from({ length: count }, (_, index) => {
    const kind = hash(index, 1);
    // Not inside Earth: at least 1.3 Earth radii off its orbit's line.
    const side = hash(index, 2) < 0.5 ? -1 : 1;
    const x = side * (1.3 + (REACH - 1.3) * hash(index, 3) ** 1.3);
    return {
      x,
      z: (hash(index, 4) * 2 - 1) * REACH,
      y: (hash(index, 5) - 0.5) * 0.6,
      kind: kind < 0.9 ? 'dust' : kind < 0.985 ? 'planetesimal' : 'embryo',
      sweptAt: hash(index, 6),
    };
  });
}

/** How much of the gas is left `myr` after the first solids: all until 2.5 Myr, none by 4.5. */
export function gasLeft(myr: number): number {
  if (myr <= 2.5) return 1;
  if (myr >= 4.5) return 0;
  const s = (myr - 2.5) / 2;
  return 1 - s * s * (3 - 2 * s);
}

/** How much of the swarm Earth has swept up by `myr`, as `model` has it grow: 0 to 1. */
export function swept(model: GrowthModel, myr: number): number {
  return Math.min(1, earthMass(model, myr) / PROTO_EARTH);
}

/** A piece drawn: its place, its size (Earth radii) and colour. */
export interface MoteMoment {
  readonly place: Triple;
  readonly size: number;
  readonly colour: Triple;
}

const COLOURS: Readonly<Record<Mote['kind'], Triple>> = {
  dust: [0.55, 0.46, 0.36],
  planetesimal: [0.62, 0.58, 0.54],
  // Embryos glow: their surfaces molten from what they sweep up.
  embryo: [1, 0.55, 0.25],
};

/**
 * `mote` at `myr` after the first solids, `played` seconds of play, Earth growing as `model` has
 * it: null once swept up, or before its kind has formed.
 */
export function moteAt(
  mote: Mote,
  model: GrowthModel,
  myr: number,
  played: number,
): MoteMoment | null {
  if (swept(model, myr) > mote.sweptAt) return null;
  // Planetesimals within about a hundred thousand years, embryos within a million.
  if (mote.kind === 'planetesimal' && myr < 0.1) return null;
  if (mote.kind === 'embryo' && myr < 1) return null;
  const span = 2 * REACH;
  // Ahead nearer the Sun, behind further out, wrapping round the reach.
  const drifted = mote.z - 1.5 * FLOW * mote.x * played;
  const z = ((((drifted + REACH) % span) + span) % span) - REACH;
  const size = mote.kind === 'dust' ? 0.12 : mote.kind === 'planetesimal' ? 0.28 : 0.6;
  // Dust fades with the gas that carries it; the solid bodies stay.
  const fade = mote.kind === 'dust' ? 0.25 + 0.75 * gasLeft(myr) : 1;
  const [r, g, b] = COLOURS[mote.kind];
  return { place: [mote.x, mote.y, z], size, colour: [r * fade, g * fade, b * fade] };
}
