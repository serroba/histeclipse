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
/** How long before the extinction the clock starts: before the first lavas. */
const BEFORE = 400 * KYR;
/** Where the linear span ends and the log tail begins. */
const TAIL_FROM = 200 * KYR;
/** The clock's end: the recovery, ten million years on. */
const AFTER = 10_000 * KYR;
/** Time a slider unit is on the linear span. */
const UNIT = 100 * KYR;
/** Slider units a tenfold is on the tail. */
const TAIL_UNITS = 2;

const TAIL_AT = (BEFORE + TAIL_FROM) / UNIT;
/** The slider's last position. */
const END = TAIL_AT + TAIL_UNITS * Math.log10(AFTER / TAIL_FROM);

function secondsAt(position: number): number {
  const at = Math.min(END, Math.max(0, position));
  if (at <= TAIL_AT) return at * UNIT - BEFORE;
  return TAIL_FROM * 10 ** ((at - TAIL_AT) / TAIL_UNITS);
}

function positionAt(seconds: number): number {
  if (seconds <= TAIL_FROM) return Math.max(0, (seconds + BEFORE) / UNIT);
  return Math.min(END, TAIL_AT + TAIL_UNITS * Math.log10(seconds / TAIL_FROM));
}

/** Slider units a second at each pace: the whole in about a minute and a half, 30 s or 10 s. */
const UNITS_PER_SECOND: Readonly<Record<Pace, number>> = { slow: 0.1, normal: 0.3, fast: 0.9 };
/** The extinction itself, played at half pace. */
const CRISIS = [positionAt(-50 * KYR), positionAt(100 * KYR)] as const;

function advance(pace: Pace, seconds: number, position: number): number {
  const slower = position >= CRISIS[0] && position < CRISIS[1] ? 0.5 : 1;
  return UNITS_PER_SECOND[pace] * slower * seconds;
}

function text(seconds: number): string {
  if (Math.abs(seconds) < 500 * YEAR) return 'The extinction begins';
  return seconds < 0
    ? `${durationText(seconds)} before the extinction`
    : `${durationText(seconds)} after it began`;
}

/** The end-Permian's clock, and any other crisis without an instant to count from. */
export const CRISIS_SCALE: ClockScale = {
  end: END,
  secondsAt,
  positionAt,
  advance,
  // Ten thousand years on the linear span.
  step: 0.1,
  marks: [
    [-300 * KYR, 'Lavas'],
    [0, 'Extinction'],
    [TAIL_FROM, '200,000 years'],
    [1000 * KYR, '1 Myr'],
    [AFTER, '10 Myr'],
  ],
  text,
  label: 'Time since the extinction began: 100,000 years a step across the crisis, then tenfolds',
};
