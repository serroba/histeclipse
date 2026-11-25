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
 * century. Everything else is illustration: the paths of single pieces, the glow, and the Moon's
 * and the disc's turning, which follows the time played, not the years, so they do not blur.
 *
 * In Earth radii, in the frame of Earth's spin axis: y along the axis, the equator the x–z plane,
 * and angles φ on it turning the way Earth spins, a point at (cos φ, 0, −sin φ).
 *
 * Pure.
 */

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
/** Theia's speed, km/s: about Earth's escape speed. */
const SPEED_KM = 9.3;
/** How grazing the hit is: the offset of Theia's path, as a share of the sum of the radii. */
const GRAZE = 0.75;

const SPAN = 1 + THEIA_RADIUS;
const OFFSET = GRAZE * SPAN;
/** Theia's centre at contact, and the point on Earth it strikes. */
const CONTACT: Triple = [OFFSET, 0, Math.sqrt(SPAN ** 2 - OFFSET ** 2)];
const STRIKE: Triple = [CONTACT[0] / SPAN, 0, CONTACT[2] / SPAN];
/** The angle of the point struck. */
export const STRIKE_ANGLE = Math.atan2(-STRIKE[2], STRIKE[0]);

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
export function theiaAt(seconds: number): TheiaMoment | null {
  if (seconds >= HOUR) return null;
  const travelled = (SPEED_KM / EARTH_KM) * seconds;
  if (seconds <= 0)
    return { center: [CONTACT[0], 0, CONTACT[2] - travelled], scale: 1, opacity: 1 };
  // After contact it slows into Earth and comes apart.
  const gone = smooth(seconds / HOUR);
  return {
    center: [CONTACT[0] * (1 - 0.4 * gone), 0, CONTACT[2] - 0.5 * travelled],
    scale: 1 - 0.5 * gone,
    opacity: 1 - gone,
  };
}

/** The flash where Theia strikes: its place, size (Earth radii) and brightness, or null. */
export function flashAt(seconds: number): { place: Triple; size: number; glow: number } | null {
  if (seconds < 0 || seconds > 12 * HOUR) return null;
  const rising = Math.min(1, seconds / (5 * MINUTE));
  const fading = 1 - logShare(seconds, 5 * MINUTE, 12 * HOUR);
  return {
    place: STRIKE,
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

/** The Moon at `seconds` since the impact, `played` seconds of play: its place, size and heat. */
export function moonAt(
  seconds: number,
  played: number,
): { place: Triple; radius: number; heat: number } | null {
  if (seconds < DAY) return null;
  // Most of its mass within a year from the outer disc; the rest over a century from the inner.
  const mass = 0.6 * logShare(seconds, DAY, YEAR) + 0.4 * logShare(seconds, YEAR, 100 * YEAR);
  return {
    place: onDisc(MOON_ORBIT, STRIKE_ANGLE + Math.PI + turned(MOON_ORBIT, played)),
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

/** Where `piece` is at `seconds` since the impact, after `played` seconds of play. */
export function pieceAt(piece: Piece, seconds: number, played: number): PieceMoment | null {
  if (seconds <= 0) return null;
  // Thrown out into an arm that wraps round, the further out the later, settled within a day.
  const s = smooth(logShare(seconds, 2 * MINUTE, DAY));
  const lag = s ** (1 + piece.r / 3);
  const span = (((piece.angle - STRIKE_ANGLE) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const angle = STRIKE_ANGLE + span * lag + (seconds > DAY ? turned(piece.r, played) : 0);
  const r = 1.02 + (piece.r - 1.02) * s + piece.fling * piece.r * Math.sin(Math.PI * s);
  const heat = 1 - 0.75 * logShare(seconds, HOUR, 100 * YEAR);
  const settled: Triple = onDisc(r, angle, piece.y * s);
  if (piece.fate === 'moon') {
    // Gathered into the Moon over the year after the first day.
    const moon = moonAt(seconds, played);
    const g = smooth(logShare(seconds, DAY, YEAR));
    if (moon === null || g === 0) return { place: settled, heat, opacity: 1 };
    const place: Triple = [
      settled[0] + (moon.place[0] - settled[0]) * g,
      settled[1] + (moon.place[1] - settled[1]) * g,
      settled[2] + (moon.place[2] - settled[2]) * g,
    ];
    return g >= 1 ? null : { place, heat, opacity: 1 - g * g };
  }
  // The inner disc over a century: part falls back onto Earth, part spreads out to the Moon.
  const g = smooth(logShare(seconds, DAY, 100 * YEAR));
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
/** Where it looks from: above the equator, so the disc shows as a ring, not edge on. */
export const IMPACT_VIEW = { latitude: 30, longitude: 0 } as const;
