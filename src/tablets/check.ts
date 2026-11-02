/**
 * Checking what a Babylonian tablet records against the sky of a candidate year.
 *
 * Each observation is dated by Babylonian month and day. A candidate year gives those months
 * their days (from the first-crescent calendar); the sky of that day is then computed and set
 * beside what the scribe wrote. The verdicts use plain tolerances, said here so a reader can
 * weigh them: a position fits when its direction is right and, where the tablet gives a
 * distance, the computed one is within a cubit of it; a lunar-six interval fits when it is
 * within 2 UŠ or a fifth of the recorded value, whichever is larger. Babylonian measures were
 * rough and the cubit itself varied, so a near miss says little; a wrong direction says more.
 *
 * The Babylonian day began at sunset: "night of the 9th" is the evening before the civil date
 * of day 9, and its morning is on that date.
 */

import { babylonianMonths, type BabylonianMonth, NABONASSAR_OFFSET } from '../time/babylonian';
import { julianDayNumber, type JulianDay } from '../time/julianDay';
import {
  type Body,
  DEGREES_PER_CUBIT,
  lunarSix,
  type LunarSix,
  offsetBetween,
  sunriseOn,
  sunsetOn,
  type TabletSky,
} from './tabletSky';

export type Relation = 'in front of' | 'behind' | 'above' | 'below' | 'near';

/**
 * When in the Babylonian day an observation was made: at dusk (half an hour after sunset, for
 * the first crescent and for bodies low in the west), in the evening (an hour and a half after),
 * or before dawn (half an hour before sunrise).
 */
export type Watch = 'dusk' | 'evening' | 'morning';

interface Dated {
  readonly id: string;
  /** Where on the tablet: "Obv. 3". */
  readonly line: string;
  readonly month: string;
  /** The day, or the days it may be when the tablet is broken or vague. */
  readonly days: readonly [first: number, last: number];
  /** What the tablet says, shortened, with the modern names. */
  readonly text: string;
}

export interface PositionObservation extends Dated {
  readonly kind: 'position';
  readonly watch: Watch;
  readonly body: Exclude<Body, { readonly star: number }>;
  readonly reference: Body;
  readonly relation: Relation;
  /** The distance in cubits, when the tablet gives one. */
  readonly cubits?: number;
}

export interface LunarSixObservation extends Dated {
  readonly kind: 'lunar six';
  readonly six: LunarSix;
  /** The interval in UŠ. */
  readonly us: number;
}

/** A fact about the calendar itself: whether the year before had a second Addaru. */
export interface LeapObservation extends Dated {
  readonly kind: 'leap';
  readonly previousLeap: string;
}

export type Observation = PositionObservation | LunarSixObservation | LeapObservation;

export interface Verdict {
  readonly observation: Observation;
  /** The civil date (fixed day) the best-fitting day falls on, or null if none was computed. */
  readonly date: number | null;
  /** The computed value, in the observation's own unit: cubits as stated, or UŠ. */
  readonly computed: number | null;
  readonly fits: boolean;
}

/** A candidate year: its months, and whether the year before it had a second Addaru. */
export interface Candidate {
  readonly months: readonly BabylonianMonth[];
  readonly previousLeap: string | null;
}

const POSITION_TOLERANCE_CUBITS = 1;
const SIX_TOLERANCE_US = 2;
const SIX_TOLERANCE_SHARE = 0.2;
/** A "near" with no distance: within a cubit. */
const NEAR_CUBITS = 1;
/** How long after sunset (days) an evening observation is taken, and before sunrise a morning. */
const AFTER_SUNSET = 1.5 / 24;
const DUSK = 0.5 / 24;
const BEFORE_SUNRISE = 0.5 / 24;

/** The moment an observation on Babylonian day `day` of a month starting on `start` is made. */
export function momentOf(
  sky: TabletSky,
  watch: Watch,
  start: number,
  day: number,
): JulianDay | null {
  // Day `day` began at sunset on the civil date before it.
  if (watch === 'morning') {
    const sunrise = sunriseOn(sky, start + day - 1);
    return sunrise === null ? null : julianDayNumber(sunrise - BEFORE_SUNRISE);
  }
  const sunset = sunsetOn(sky, start + day - 2);
  if (sunset === null) return null;
  return julianDayNumber(sunset + (watch === 'dusk' ? DUSK : AFTER_SUNSET));
}

/** The computed value of a position, in cubits, signed so that positive agrees with the text. */
export function positionCubits(
  sky: TabletSky,
  observation: PositionObservation,
  moment: JulianDay,
): number {
  const { along, across } = offsetBetween(sky, observation.body, observation.reference, moment);
  switch (observation.relation) {
    case 'in front of':
      return -along / DEGREES_PER_CUBIT;
    case 'behind':
      return along / DEGREES_PER_CUBIT;
    case 'above':
      return across / DEGREES_PER_CUBIT;
    case 'below':
      return -across / DEGREES_PER_CUBIT;
    case 'near':
      return Math.hypot(along, across) / DEGREES_PER_CUBIT;
  }
}

function positionFits(observation: PositionObservation, cubits: number): boolean {
  if (observation.relation === 'near') return cubits <= (observation.cubits ?? NEAR_CUBITS);
  if (cubits <= 0) return false;
  return (
    observation.cubits === undefined ||
    Math.abs(cubits - observation.cubits) <= POSITION_TOLERANCE_CUBITS
  );
}

function sixFits(recorded: number, computed: number): boolean {
  return (
    Math.abs(computed - recorded) <= Math.max(SIX_TOLERANCE_US, SIX_TOLERANCE_SHARE * recorded)
  );
}

/** How far a computed value is from what was recorded: the day that fits best wins. */
function miss(observation: PositionObservation | LunarSixObservation, computed: number): number {
  if (observation.kind === 'lunar six') return Math.abs(computed - observation.us);
  if (observation.relation === 'near') return computed;
  if (observation.cubits !== undefined) return Math.abs(computed - observation.cubits);
  return computed > 0 ? 0 : -computed;
}

function computeOn(
  sky: TabletSky,
  observation: PositionObservation | LunarSixObservation,
  start: number,
  day: number,
): { readonly date: number; readonly computed: number } | null {
  if (observation.kind === 'lunar six') {
    const evening =
      observation.six === 'NA first' || observation.six === 'ME' || observation.six === 'GE6';
    const date = evening ? start + day - 2 : start + day - 1;
    const computed = lunarSix(sky, observation.six, date);
    return computed === null ? null : { date, computed };
  }
  const moment = momentOf(sky, observation.watch, start, day);
  if (moment === null) return null;
  const date = observation.watch === 'morning' ? start + day - 1 : start + day - 2;
  return { date, computed: positionCubits(sky, observation, moment) };
}

/** Check one observation against a candidate year. */
export function check(sky: TabletSky, observation: Observation, candidate: Candidate): Verdict {
  if (observation.kind === 'leap') {
    const fits = candidate.previousLeap === observation.previousLeap;
    return { observation, date: null, computed: null, fits };
  }
  const month = candidate.months.find(({ name }) => name === observation.month);
  if (month === undefined) return { observation, date: null, computed: null, fits: false };
  let best: { readonly date: number; readonly computed: number } | null = null;
  for (let day = observation.days[0]; day <= observation.days[1]; day++) {
    const found = computeOn(sky, observation, month.start, day);
    if (
      found !== null &&
      (best === null || miss(observation, found.computed) < miss(observation, best.computed))
    ) {
      best = found;
    }
  }
  if (best === null) return { observation, date: null, computed: null, fits: false };
  const fits =
    observation.kind === 'lunar six'
      ? sixFits(observation.us, best.computed)
      : positionFits(observation, best.computed);
  return { observation, date: best.date, computed: best.computed, fits };
}

/** Check every observation against a candidate year. */
export function checkAll(
  sky: TabletSky,
  observations: readonly Observation[],
  candidate: Candidate,
): readonly Verdict[] {
  return observations.map((observation) => check(sky, observation, candidate));
}

const MONTH_NAMES = [
  'Nisannu',
  'Ayyaru',
  'Simanu',
  'Duzu',
  'Abu',
  'Ululu',
  'Tashritu',
  'Arahsamna',
  'Kislimu',
  'Tebetu',
  'Shabatu',
  'Addaru',
] as const;

/**
 * A candidate year for a tablet dated in a king's year: the Babylonian year beginning in spring
 * of `bce`, with its months from the first-crescent calendar, or null outside it.
 *
 * `shift` moves Nisannu that many months later (or earlier, if negative) than the calendar puts
 * it, for readings that assume a different leap month; the year is then taken to have twelve
 * months and the year before a second Addaru only if `shift` is positive.
 */
export function candidateYear(bce: number, shift = 0): Candidate | null {
  const year = NABONASSAR_OFFSET + 1 - bce;
  const months = babylonianMonths(year);
  const next = babylonianMonths(year + 1);
  const before = babylonianMonths(year - 1);
  if (months === null || next === null || before === null) return null;
  const previousLeap = before.find(({ name }) => name.endsWith(' II'))?.name ?? null;
  if (shift === 0) return { months, previousLeap };
  const run = [...before, ...months, ...next];
  const from = before.length + shift;
  return {
    months: MONTH_NAMES.map((name, place) => ({
      name,
      start: run[from + place]?.start ?? Number.NaN,
    })),
    previousLeap: shift > 0 ? 'Addaru II' : null,
  };
}
