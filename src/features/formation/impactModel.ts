/**
 * The giant impact and the Moon gathering, the canonical case (#180), as the formation clock
 * draws it: where Theia, the flash, each piece of debris and the Moon are at a moment.
 *
 * Grounded in the canonical simulations (Canup & Asphaug 2001; Canup 2004; Ida, Canup & Stewart
 * 1997; Salmon & Canup 2012): a Mars-sized body (about 0.53 Earth radii) comes in at about Earth's
 * escape speed on a grazing path; debris is thrown into an arm that wraps round Earth and settles
 * within a day into a disc, part inside the distance where Earth's tides pull a moon apart (the
 * Roche limit, about 2.9 Earth radii) and part beyond; the Moon gathers just outside it, about
 * 3.8 Earth radii out, most of it within a year and the rest from the inner disc over about a
 * century; then it draws away as its tides slow Earth's spin (`moonOrbit`). Everything else is illustration: the paths of single pieces, the glow, and the Moon's
 * and the disc's turning, which follows the time played, not the years, so they do not blur.
 *
 * In Earth radii, in the frame of Earth's spin axis: y along the axis, the equator the x–z plane,
 * and angles φ on it turning the way Earth spins, a point at (cos φ, 0, −sin φ).
 *
 * Pure.
 */

import { THEIA_CHOICES, type Hit } from '../../deepTime/theia';

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86_400;
const YEAR = 365.25 * DAY;
/** Earth's radius, km. */
const EARTH_KM = 6371;

export type Triple = readonly [number, number, number];

/** Theia's radius: a body of about Mars's size and a tenth of Earth's mass. */
export const THEIA_RADIUS = 0.53;
/** The Moon's radius, once whole. */
export const MOON_RADIUS = 0.273;
/** Where the Moon gathers: just outside the Roche limit. */
export const MOON_ORBIT = 3.8;
/** The Roche limit, inside which Earth's tides keep debris from gathering. */
export const ROCHE = 2.9;
/** Where the Moon is thrown straight into orbit, when it forms within hours: far outside the
 * Roche limit, a nearly circular orbit with its periapsis 7.1 Earth radii out in Kegerreis et
 * al. 2022's example, drawn at 7. */
export const IMMEDIATE_ORBIT = 7;

/**
 * When the Moon starts drawing away, seconds after the impact: from then its distance grows as
 * the 2/13 power of time, as tides of a constant strength give, to about 15 Earth radii at ten
 * million years. How far it went in that time is argued, from 7–9 Earth radii (Korenaga 2023) to
 * 30–40 (Zahnle et al. 2015; Farhat et al. 2025): drawn between them.
 */
const RECEDES_FROM = 1300 * YEAR;

/** How far out the Moon is, `seconds` after the impact, having formed `start` Earth radii out. */
export function moonOrbit(seconds: number, start = MOON_ORBIT): number {
  if (seconds <= RECEDES_FROM) return start;
  return Math.max(start, MOON_ORBIT * (seconds / RECEDES_FROM) ** (2 / 13));
}

/** The canonical hit, drawn unless another is chosen. */
export const CANONICAL: Hit = THEIA_CHOICES.canonical.hit;

/** Where a hit touches: Theia's centre at contact, the point struck, and that point's angle. */
interface Contact {
  readonly center: Triple;
  readonly strike: Triple;
  readonly angle: number;
}

const contacts = new WeakMap<Hit, Contact>();

/** Where `hit` touches the proto-Earth, at its size then. */
function contactOf(hit: Hit): Contact {
  const known = contacts.get(hit);
  if (known !== undefined) return known;
  const earth = Math.cbrt(hit.protoEarth);
  const span = earth + hit.radius;
  const offset = hit.graze * span;
  const center: Triple = [offset, 0, Math.sqrt(span ** 2 - offset ** 2)];
  const strike: Triple = [(center[0] * earth) / span, 0, (center[2] * earth) / span];
  const made = { center, strike, angle: Math.atan2(-strike[2], strike[0]) };
  contacts.set(hit, made);
  return made;
}

/** The angle of the point `hit` strikes. */
export function strikeAngle(hit: Hit = CANONICAL): number {
  return contactOf(hit).angle;
}

/** The angle of the point the canonical hit strikes. */
export const STRIKE_ANGLE = strikeAngle();

/** A point at radius `r` and angle `φ` on the equator, `y` off it. */
export function onDisc(r: number, angle: number, y = 0): Triple {
  return [r * Math.cos(angle), y, -r * Math.sin(angle)];
}

/** How far `t` is from `from` to `to`, on log time, 0 to 1. */
function logShare(t: number, from: number, to: number): number {
  if (t <= from) return 0;
  if (t >= to) return 1;
  return Math.log(t / from) / Math.log(to / from);
}

const smooth = (s: number): number => s * s * (3 - 2 * s);

/** When the Moon gathers, and when the rest of the debris clears, seconds after the impact. */
function timing(hit: Hit): { gather: readonly [number, number]; clear: readonly [number, number] } {
  switch (hit.outcome) {
    case 'immediate':
      return { gather: [3 * HOUR, 12 * HOUR], clear: [DAY, YEAR] };
    case 'synestia':
      return { gather: [DAY, 10 * YEAR], clear: [DAY, 10 * YEAR] };
    case 'moonlets':
      return { gather: [DAY, YEAR], clear: [DAY, 10 * YEAR] };
    case 'disc':
      return { gather: [DAY, YEAR], clear: [DAY, 100 * YEAR] };
  }
}

/**
 * The later hits of the many-hits case (#1220), seconds after the first: drawn as five more, the
 * spacing invented, each flashing on Earth and adding a moonlet to the Moon.
 */
export const LATER_HITS: readonly number[] = [
  100 * YEAR,
  1e4 * YEAR,
  3e5 * YEAR,
  2e6 * YEAR,
  6e6 * YEAR,
];

/** A later hit's flash, if one is showing at `seconds`: it lasts half as long again as its time. */
function laterFlash(
  seconds: number,
  angle: number,
): { place: Triple; size: number; glow: number } | null {
  const index = LATER_HITS.findIndex((at) => seconds >= at && seconds < 1.5 * at);
  const at = LATER_HITS[index];
  if (at === undefined) return null;
  return {
    place: onDisc(1, angle + 1.3 * (index + 1)),
    size: 0.6,
    glow: 1 - logShare(seconds, at, 1.5 * at),
  };
}

export interface TheiaMoment {
  readonly center: Triple;
  /** Its size, 1 whole; and how much is seen, 0 to 1. */
  readonly scale: number;
  readonly opacity: number;
}

/**
 * Theia at `seconds` since the impact: coming in along its grazing path, then sheared and gone
 * into the debris within the hour. Null when it is not drawn.
 */
export function theiaAt(seconds: number, hit: Hit = CANONICAL): TheiaMoment | null {
  if (seconds >= HOUR) return null;
  const { center } = contactOf(hit);
  const travelled = (hit.speedKm / EARTH_KM) * seconds;
  // Its size, against the canonical Theia's the mesh is made at.
  const size = hit.radius / THEIA_RADIUS;
  if (seconds <= 0)
    return { center: [center[0], 0, center[2] - travelled], scale: size, opacity: 1 };
  // After contact it slows into Earth and comes apart.
  const gone = smooth(seconds / HOUR);
  return {
    center: [center[0] * (1 - 0.4 * gone), 0, center[2] - 0.5 * travelled],
    scale: size * (1 - 0.5 * gone),
    opacity: 1 - gone,
  };
}

/** The flash where Theia strikes: its place, size (Earth radii) and brightness, or null. */
export function flashAt(
  seconds: number,
  hit: Hit = CANONICAL,
): { place: Triple; size: number; glow: number } | null {
  if (hit.outcome === 'moonlets' && seconds > 12 * HOUR)
    return laterFlash(seconds, strikeAngle(hit));
  if (seconds < 0 || seconds > 12 * HOUR) return null;
  const rising = Math.min(1, seconds / (5 * MINUTE));
  const fading = 1 - logShare(seconds, 5 * MINUTE, 12 * HOUR);
  return {
    place: contactOf(hit).strike,
    size: 0.4 + 1.4 * logShare(seconds, 10, 30 * MINUTE),
    glow: rising * fading,
  };
}

/** One piece of debris: where it ends up in the disc, drawn from its seed. */
export interface Piece {
  /** Its radius in the disc. */
  readonly r: number;
  readonly angle: number;
  /** Off the disc's plane. */
  readonly y: number;
  /** Beyond the Roche limit it gathers into the Moon; inside, it falls back or spreads out. */
  readonly fate: 'moon' | 'falls' | 'spreads';
  /** How far out it is thrown before it settles, as a share of its radius. */
  readonly fling: number;
}

/** A number from 0 to 1 for `index` and `salt`, the same each time. */
function hash(index: number, salt: number): number {
  let h = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4_294_967_296;
}

/** The `count` pieces of debris: half inside the Roche limit, half beyond. */
export function pieces(count: number): readonly Piece[] {
  return Array.from({ length: count }, (_, index) => {
    const outer = index % 2 === 0;
    const r = outer ? ROCHE + 1.6 * hash(index, 1) : 1.15 + (ROCHE - 1.15) * hash(index, 1);
    return {
      r,
      angle: 2 * Math.PI * hash(index, 2),
      y: (hash(index, 3) - 0.5) * 0.12 * r,
      fate: outer ? 'moon' : hash(index, 4) < 0.5 ? 'falls' : 'spreads',
      fling: 0.1 + 0.5 * hash(index, 5),
    };
  });
}

/**
 * How far round the turning has gone, radians, for something at radius `r` after `played` seconds
 * of play: faster further in, as orbits go, but slow enough to follow.
 */
export function turned(r: number, played: number): number {
  return 0.5 * (r / 1.5) ** -1.5 * played;
}

/** The Moon's share of its mass at `seconds` since the impact, at least a day, as `hit` builds it. */
function moonMass(seconds: number, hit: Hit): number {
  switch (hit.outcome) {
    // Condensing inside the synestia over its decade.
    case 'synestia':
      return logShare(seconds, DAY, 10 * YEAR);
    // A moonlet from each hit: the first within a year, one more with each later hit.
    case 'moonlets': {
      const later = LATER_HITS.filter((at) => seconds >= at).length;
      return (logShare(seconds, DAY, YEAR) + later) / (LATER_HITS.length + 1);
    }
    // Most of it within a year from the outer disc; the rest over a century from the inner.
    case 'disc':
    case 'immediate':
      return 0.6 * logShare(seconds, DAY, YEAR) + 0.4 * logShare(seconds, YEAR, 100 * YEAR);
  }
}

/** The Moon at `seconds` since the impact, `played` seconds of play: its place, size and heat. */
export function moonAt(
  seconds: number,
  played: number,
  hit: Hit = CANONICAL,
): { place: Triple; radius: number; heat: number } | null {
  const angle = strikeAngle(hit);
  if (hit.outcome === 'immediate') {
    // Thrown out of the arm whole within hours, out to a wide orbit; little to gather after.
    if (seconds < 3 * HOUR) return null;
    const out = smooth(logShare(seconds, 3 * HOUR, 12 * HOUR));
    const r = moonOrbit(seconds, 2 + (IMMEDIATE_ORBIT - 2) * out);
    return {
      place: onDisc(r, angle + 2 + turned(r, played)),
      radius: MOON_RADIUS * Math.cbrt(0.85 + 0.15 * out),
      heat: 1 - logShare(seconds, 1000 * YEAR, 1e7 * YEAR),
    };
  }
  if (seconds < DAY) return null;
  const mass = moonMass(seconds, hit);
  const r = moonOrbit(seconds);
  return {
    place: onDisc(r, angle + Math.PI + turned(r, played)),
    radius: MOON_RADIUS * Math.cbrt(Math.max(0.05, mass)),
    // Molten, then crusting over in its first ten million years.
    heat: 1 - logShare(seconds, 1000 * YEAR, 1e7 * YEAR),
  };
}

/** A piece of debris drawn: where it is, how hot (0 to 1), and how much is seen (0 to 1). */
export interface PieceMoment {
  readonly place: Triple;
  readonly heat: number;
  readonly opacity: number;
}

/**
 * A piece of a synestia (#1220): the debris swollen into a thick doughnut of hot vapour, out
 * past where the Moon forms, shrinking back as it cools over its decade.
 */
function inSynestia(
  piece: Piece,
  seconds: number,
  at: { readonly r: number; readonly angle: number; readonly s: number; readonly heat: number },
): PieceMoment | null {
  const g = smooth(logShare(seconds, DAY, 10 * YEAR));
  if (g >= 1) return null;
  const r = (1.02 + (1.6 * piece.r - 1.02) * at.s) * (1 - 0.6 * g);
  return {
    place: onDisc(r, at.angle, 4 * piece.y * at.s * (1 - g)),
    heat: Math.max(at.heat, 0.8 * (1 - g)),
    opacity: 1 - g,
  };
}

/** Where `piece` is at `seconds` since the impact, after `played` seconds of play. */
export function pieceAt(
  piece: Piece,
  seconds: number,
  played: number,
  hit: Hit = CANONICAL,
): PieceMoment | null {
  if (seconds <= 0) return null;
  const struck = strikeAngle(hit);
  const { gather, clear } = timing(hit);
  // Thrown out into an arm that wraps round, the further out the later, settled within a day.
  const s = smooth(logShare(seconds, 2 * MINUTE, DAY));
  const lag = s ** (1 + piece.r / 3);
  const span = (((piece.angle - struck) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const angle = struck + span * lag + (seconds > DAY ? turned(piece.r, played) : 0);
  const r = 1.02 + (piece.r - 1.02) * s + piece.fling * piece.r * Math.sin(Math.PI * s);
  const heat = 1 - 0.75 * logShare(seconds, HOUR, 100 * YEAR);
  if (hit.outcome === 'synestia') return inSynestia(piece, seconds, { r, angle, s, heat });
  const settled: Triple = onDisc(r, angle, piece.y * s);
  if (piece.fate === 'moon') {
    // Gathered into the Moon: over the year after the first day, or within hours.
    const moon = moonAt(seconds, played, hit);
    const g = smooth(logShare(seconds, ...gather));
    if (moon === null || g === 0) return { place: settled, heat, opacity: 1 };
    const place: Triple = [
      settled[0] + (moon.place[0] - settled[0]) * g,
      settled[1] + (moon.place[1] - settled[1]) * g,
      settled[2] + (moon.place[2] - settled[2]) * g,
    ];
    return g >= 1 ? null : { place, heat, opacity: 1 - g * g };
  }
  // The inner disc over a century: part falls back onto Earth, part spreads out to the Moon.
  const g = smooth(logShare(seconds, ...clear));
  if (g >= 1) return null;
  const to = piece.fate === 'falls' ? 1 : ROCHE;
  return {
    place: onDisc(r + (to - r) * g, angle, piece.y * s * (1 - g)),
    heat,
    opacity: 1 - g,
  };
}

/** The colour of something as hot as `heat` (0 to 1): white-hot, to orange, to dull red. */
export function glowColour(heat: number): Triple {
  const h = Math.min(1, Math.max(0, heat));
  return [0.45 + 0.55 * Math.min(1, h * 1.6), 0.12 + 0.8 * h ** 1.5, 0.05 + 0.6 * h ** 3];
}

/** The Moon's colour at `heat`: molten orange, cooling to grey rock. */
export function moonColour(heat: number): Triple {
  const h = Math.min(1, Math.max(0, heat));
  return [0.55 + 0.45 * h, 0.55 - 0.13 * h, 0.55 - 0.42 * h];
}

/** How far out the camera stands to see it all: past the Moon's orbit, with room. */
export const IMPACT_DISTANCE = 22;
/** How far it stands once the Moon has drawn away, from `RECEDED` seconds on: its orbit in view. */
export const RECEDED_DISTANCE = 64;
export const RECEDED = 1e5 * YEAR;
/** Where it looks from: above the equator, so the disc shows as a ring, not edge on. */
export const IMPACT_VIEW = { latitude: 30, longitude: 0 } as const;
