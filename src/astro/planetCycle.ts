/**
 * A body's cycle as Earth sees it (#329), for the bottom bar away from Earth. A planet's is its
 * synodic period: from one conjunction (beyond the Sun) to the next, with opposition for the
 * outer planets, and for Mercury and Venus the greatest elongations either side of passing
 * between us and the Sun. The Sun's is Earth's year, from perihelion to perihelion, with
 * aphelion between.
 *
 * Found by search on the same VSOP87 theory that places the bodies. Pure.
 */

import { eclipticLongitude } from './bodyFacts';
import type { EquatorialVector } from './moon';
import type { PlanetEphemeris, PlanetName } from './planets';

export type CycleMark =
  /** Conjunction (superior, for Mercury and Venus): beyond the Sun, lost in its glare. */
  | 'behind'
  /** Opposition: opposite the Sun, near its closest and brightest, up all night. */
  | 'opposite'
  /** Inferior conjunction: between Earth and the Sun. */
  | 'between'
  /** Greatest elongation east of the Sun: its best evening showing. */
  | 'evening'
  /** Greatest elongation west of the Sun: its best morning showing. */
  | 'morning'
  /** Earth nearest the Sun, and farthest. */
  | 'perihelion'
  | 'aphelion';

interface CycleEvent {
  readonly mark: CycleMark;
  /** TT Julian Day. */
  readonly jdTT: number;
}

export interface BodyCycle {
  /** TT Julian Days the cycle runs between: the moment shown is in [start, end). */
  readonly start: number;
  readonly end: number;
  /** In order, from the one at the start to the one at the end. */
  readonly events: readonly CycleEvent[];
}

type Heliocentric = Pick<PlanetEphemeris, 'heliocentric'>;

/** Mean synodic periods, days: the guesses the searches start from. */
export const SYNODIC_DAYS: Readonly<Record<PlanetName, number>> = {
  mercury: 115.88,
  venus: 583.92,
  mars: 779.94,
  jupiter: 398.88,
  saturn: 378.09,
};

/** The anomalistic year, perihelion to perihelion, days. */
const ANOMALISTIC_YEAR = 365.259_6;

/** How closely the searches pin a moment down, days: about a minute. */
const PRECISION = 1 / 1440;
const GOLDEN = (Math.sqrt(5) - 1) / 2;
const DEGREES = 180 / Math.PI;

const INNER: ReadonlySet<PlanetName> = new Set(['mercury', 'venus']);

/** An angle in degrees, wrapped to (−180, 180]. */
function wrap(degrees: number): number {
  return 180 - ((((180 - degrees) % 360) + 360) % 360);
}

function length([x, y, z]: EquatorialVector): number {
  return Math.hypot(x, y, z);
}

/** Degrees between two directions. */
function angleBetween(a: EquatorialVector, b: EquatorialVector): number {
  const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (length(a) * length(b));
  return Math.acos(Math.min(1, Math.max(-1, cos))) * DEGREES;
}

/** The time in [from, to] where `f` is greatest, for a single-peaked `f`. */
function peak(f: (jd: number) => number, from: number, to: number): number {
  let [low, high] = [from, to];
  // Golden-section search: each step keeps one of its two inner points for the next.
  let a = high - GOLDEN * (high - low);
  let b = low + GOLDEN * (high - low);
  let [fa, fb] = [f(a), f(b)];
  while (high - low > PRECISION) {
    if (fa < fb) {
      [low, a, fa] = [a, b, fb];
      b = low + GOLDEN * (high - low);
      fb = f(b);
    } else {
      [high, b, fb] = [b, a, fa];
      a = high - GOLDEN * (high - low);
      fa = f(a);
    }
  }
  return (low + high) / 2;
}

/** A planet's cycle around `jdTT`: conjunction to conjunction, with what lies between. */
export function planetCycle(ephemeris: Heliocentric, planet: PlanetName, jdTT: number): BodyCycle {
  const synodic = SYNODIC_DAYS[planet];
  const inner = INNER.has(planet);
  // How far ahead of Earth the planet is, seen from the Sun along the ecliptic: it gains on
  // Earth if inner, and falls behind if outer, so that `ahead` grows through a whole cycle.
  const sense = inner ? 1 : -1;
  const ahead = (jd: number, target: number): number =>
    sense *
    wrap(
      eclipticLongitude(ephemeris.heliocentric(planet, jd)) -
        eclipticLongitude(ephemeris.heliocentric('earth', jd)) -
        target,
    );
  /** When the planet is `target` degrees ahead of Earth, near `guess`. */
  const when = (target: number, guess: number): number => {
    let [low, high] = [guess - synodic / 4, guess + synodic / 4];
    while (high - low > PRECISION) {
      const middle = (low + high) / 2;
      if (ahead(middle, target) < 0) low = middle;
      else high = middle;
    }
    return (low + high) / 2;
  };
  // Back from the moment shown by the share of a cycle gone since the last conjunction.
  const since = ((((ahead(jdTT, 180) % 360) + 360) % 360) / 360) * synodic;
  let start = when(180, jdTT - since);
  if (start > jdTT) start = when(180, start - synodic);
  let end = when(180, start + synodic);
  if (end <= jdTT) [start, end] = [end, when(180, end + synodic)];
  const middle = when(0, (start + end) / 2);
  const between: CycleEvent[] = inner
    ? (() => {
        const elongation = (jd: number): number => {
          const earth = ephemeris.heliocentric('earth', jd);
          const body = ephemeris.heliocentric(planet, jd);
          const sun: EquatorialVector = [-earth[0], -earth[1], -earth[2]];
          return angleBetween([body[0] + sun[0], body[1] + sun[1], body[2] + sun[2]], sun);
        };
        return [
          { mark: 'evening', jdTT: peak(elongation, start, middle) },
          { mark: 'between', jdTT: middle },
          { mark: 'morning', jdTT: peak(elongation, middle, end) },
        ];
      })()
    : [{ mark: 'opposite', jdTT: middle }];
  return {
    start,
    end,
    events: [{ mark: 'behind', jdTT: start }, ...between, { mark: 'behind', jdTT: end }],
  };
}

/** Earth's year around `jdTT`, as the Sun's cycle: perihelion to perihelion, aphelion between. */
export function sunCycle(ephemeris: Heliocentric, jdTT: number): BodyCycle {
  const distance = (jd: number): number => length(ephemeris.heliocentric('earth', jd));
  const year = ANOMALISTIC_YEAR;
  const nearest = (guess: number): number => peak((jd) => -distance(jd), guess - 12, guess + 12);
  // The nearest of a year of samples is by the perihelion before the moment, or just after it.
  let [guess, least] = [jdTT, distance(jdTT)];
  for (let jd = jdTT - year; jd < jdTT; jd += 8) {
    const here = distance(jd);
    if (here < least) [guess, least] = [jd, here];
  }
  let start = nearest(guess);
  if (start > jdTT) start = nearest(start - year);
  let end = nearest(start + year);
  if (end <= jdTT) [start, end] = [end, nearest(end + year)];
  return {
    start,
    end,
    events: [
      { mark: 'perihelion', jdTT: start },
      { mark: 'aphelion', jdTT: peak(distance, start + year / 2 - 12, start + year / 2 + 12) },
      { mark: 'perihelion', jdTT: end },
    ],
  };
}
