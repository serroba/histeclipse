/**
 * The crisis clock (#1191): an event with no instant, such as the end-Permian, whose eruptions
 * ran for hundreds of thousands of years and whose extinction took tens of thousands. Time is
 * counted from the extinction's start: linearly across the crisis, from 400,000 years before to
 * 200,000 after, a slider unit to each 100,000 years; then on a log tail to 10 million years
 * after, two units to each tenfold, through the slow recovery. Play runs at half pace across the
 * extinction itself, so it can be read.
 *
 * Pure.
 */

import type { ClockScale } from './clockScale';
import type { Pace } from './playSpeed';
import { durationText } from './strikeClock';

const YEAR = 365.25 * 86_400;
const KYR = 1000 * YEAR;
/** Slider units a tenfold is on the tail. */
const TAIL_UNITS = 2;
/** The clock's end: the recovery, ten million years on. */
const AFTER = 10_000 * KYR;

/** How a crisis clock runs: its linear span, played slower over the extinction if given. */
interface CrisisOptions {
  /** How long before the extinction the clock starts. */
  readonly before: number;
  /** Where the linear span ends and the log tail begins. */
  readonly tailFrom: number;
  /** Time a slider unit is on the linear span. */
  readonly unit: number;
  /** Slider units a second at each pace. */
  readonly unitsPerSecond: Readonly<Record<Pace, number>>;
  /** The span played at half pace, seconds since the extinction began; none if left out. */
  readonly slower?: readonly [number, number];
  readonly marks: readonly (readonly [number, string])[];
  readonly label: string;
  readonly hint: string;
}

function text(seconds: number): string {
  if (Math.abs(seconds) < 500 * YEAR) return 'The extinction begins';
  return seconds < 0
    ? `${durationText(seconds)} before the extinction`
    : `${durationText(seconds)} after the extinction began`;
}

/** A crisis clock: linear over `before` to `tailFrom`, then by tenfolds to 10 million years. */
function crisisScale(options: CrisisOptions): ClockScale {
  const { before, tailFrom, unit } = options;
  const tailAt = (before + tailFrom) / unit;
  const end = tailAt + TAIL_UNITS * Math.log10(AFTER / tailFrom);
  const secondsAt = (position: number): number => {
    const at = Math.min(end, Math.max(0, position));
    if (at <= tailAt) return at * unit - before;
    return tailFrom * 10 ** ((at - tailAt) / TAIL_UNITS);
  };
  const positionAt = (seconds: number): number => {
    if (seconds <= tailFrom) return Math.max(0, (seconds + before) / unit);
    return Math.min(end, tailAt + TAIL_UNITS * Math.log10(seconds / tailFrom));
  };
  const [slowFrom, slowTo] = options.slower ?? [0, 0];
  const slowStart = positionAt(slowFrom);
  const slowEnd = positionAt(slowTo);
  return {
    end,
    secondsAt,
    positionAt,
    advance(pace, seconds, position) {
      const half = position >= slowStart && position < slowEnd ? 0.5 : 1;
      return options.unitsPerSecond[pace] * half * seconds;
    },
    // A tenth of a unit.
    step: 0.1,
    marks: options.marks,
    text,
    label: options.label,
    hint: options.hint,
  };
}

/**
 * The end-Permian's clock, and the other volcanic crises': 400,000 years before to 200,000
 * after, a unit each 100,000 years, the extinction itself at half pace; the whole in about a
 * minute and a half at Slow.
 */
export const CRISIS_SCALE: ClockScale = crisisScale({
  before: 400 * KYR,
  tailFrom: 200 * KYR,
  unit: 100 * KYR,
  unitsPerSecond: { slow: 0.1, normal: 0.3, fast: 0.9 },
  slower: [-50 * KYR, 100 * KYR],
  marks: [
    [-300 * KYR, 'Lavas'],
    [0, 'Extinction'],
    [200 * KYR, '+200,000 yr'],
    [AFTER, '10 million yr'],
  ],
  label:
    'Time since the extinction began: 100,000 years a step across the crisis, then each step ten times longer',
  hint: 'Steady through the crisis, slower over the extinction; from 200,000 years after, each step is ten times longer.',
});

/**
 * The long crises' clock (#1202), the end-Ordovician's and the Late Devonian's, their pulses
 * hundreds of thousands of years to a million apart: a million years before to two million
 * after, a unit each 250,000 years; the whole in about a minute and a half at Slow.
 */
export const LONG_CRISIS_SCALE: ClockScale = crisisScale({
  before: 1000 * KYR,
  tailFrom: 2000 * KYR,
  unit: 250 * KYR,
  unitsPerSecond: { slow: 0.15, normal: 0.45, fast: 1.35 },
  marks: [
    [-1000 * KYR, 'Before'],
    [0, 'First pulse'],
    [1000 * KYR, '1 million yr'],
    [AFTER, '10 million yr'],
  ],
  label:
    'Time since the extinction began: 250,000 years a step across the crisis, then each step ten times longer',
  hint: 'Steady through the crisis; from 2 million years after, each step is ten times longer.',
});
