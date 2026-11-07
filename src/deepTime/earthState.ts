/**
 * Earth's poles, magnetic field, tilt and day in deep time: what is measured, what is
 * estimated, and where the sources disagree. Each value carries its source, and none is
 * smoothed into a curve the measurements do not support.
 */

import { scaleEnd, scalePolarity, type PolarityScale } from '../data/polarity';
import { elementAt } from '../util/arrays';

/** Polarity of the magnetic field: as today (normal), swapped, or swapping often. */
export type Polarity = 'normal' | 'reversed' | 'mixed';

export interface PolarityInterval {
  readonly polarity: Polarity;
  readonly name: string;
  /** Youngest and oldest edges, Ma. */
  readonly young: number;
  readonly old: number;
  readonly note: string;
}

/** The field has kept today's polarity since the Brunhes–Matuyama reversal (GTS 2020). */
export const LAST_REVERSAL_MA = 0.773;

/**
 * Superchrons: long spans without reversals. Edges are approximate: the Cretaceous one's
 * start is 121 Ma in the Geologic Time Scale 2020 and nearer 120 Ma in newer dating (Li et
 * al. 2023); the Kiaman's edges are hard to tie to the time scale.
 */
export const SUPERCHRONS: readonly PolarityInterval[] = [
  {
    polarity: 'normal',
    name: 'Cretaceous Normal Superchron',
    young: 83,
    old: 121,
    note: 'No reversals for about 38 million years. Its start is dated 121 Ma (GTS 2020) or near 120 Ma (Li et al. 2023).',
  },
  {
    polarity: 'reversed',
    name: 'Kiaman Reverse Superchron',
    young: 267,
    old: 318,
    note: 'Reversed for about 50 million years, with a few short normal spells in the early Permian.',
  },
];

/** Sea floor older than this has been subducted, so the reversal record before it comes from rocks on land. */
export const SEA_FLOOR_RECORD_MA = 180;

export interface FieldState {
  readonly polarity: Polarity;
  readonly interval: PolarityInterval | null;
  /** Whether the reversal record here comes only from rocks on land (patchier). */
  readonly landRecord: boolean;
}

/**
 * The field `ma` million years ago: from the polarity time scale where it reaches (every
 * reversal of the last 83 Ma), else a superchron's, else reversing often.
 */
export function fieldAt(ma: number, scale: PolarityScale | null = null): FieldState {
  const landRecord = ma > SEA_FLOOR_RECORD_MA;
  // The scale ends inside C33r, the chron just before the Cretaceous Normal Superchron: its
  // last interval runs on to the superchron's edge, whose date differs a little by source.
  const [cretaceous] = SUPERCHRONS;
  const reach =
    scale !== null && cretaceous !== undefined && ma > scaleEnd(scale) && ma < cretaceous.young
      ? scaleEnd(scale)
      : ma;
  const measured = scale === null ? null : scalePolarity(scale, reach);
  if (measured !== null) return { polarity: measured, interval: null, landRecord };
  const interval = SUPERCHRONS.find(({ young, old }) => ma >= young && ma <= old) ?? null;
  if (interval !== null) return { polarity: interval.polarity, interval, landRecord };
  return { polarity: ma < LAST_REVERSAL_MA ? 'normal' : 'mixed', interval: null, landRecord };
}

/** A stretch of time of one polarity, for drawing: young and old edges, Ma. */
export interface PolaritySpan {
  readonly young: number;
  readonly old: number;
  readonly polarity: Polarity | 'unknown';
}

/** Before this the record is too sparse to say which way the field pointed. */
export const POLARITY_RECORD_MA = 540;

/**
 * The field's polarity across `youngest` to `oldest` Ma, youngest first: every reversal the
 * scale records, the superchrons, reversing often between them, and unknown before the record.
 */
export function polaritySpans(
  scale: PolarityScale | null,
  oldest: number,
  youngest = 0,
): readonly PolaritySpan[] {
  const edges = new Set<number>([youngest, oldest]);
  for (const age of scale?.boundaries ?? []) edges.add(age);
  for (const { young, old } of SUPERCHRONS) edges.add(young).add(old);
  edges.add(LAST_REVERSAL_MA).add(POLARITY_RECORD_MA);
  const cuts = [...edges].filter((age) => age >= youngest && age <= oldest).sort((a, b) => a - b);
  const spans: PolaritySpan[] = [];
  for (let i = 1; i < cuts.length; i += 1) {
    const young = elementAt(cuts, i - 1);
    const old = elementAt(cuts, i);
    const middle = (young + old) / 2;
    const polarity = middle > POLARITY_RECORD_MA ? 'unknown' : fieldAt(middle, scale).polarity;
    const last = spans.at(-1);
    if (last?.polarity === polarity) spans[spans.length - 1] = { ...last, old };
    else spans.push({ young, old, polarity });
  }
  return spans;
}

/** A measured length of day, from growth lines counted in a year. */
export interface DayMeasurement {
  readonly ma: number;
  readonly hours: number;
  /** ± hours, where the source gives one. */
  readonly uncertainty: number | null;
  readonly daysPerYear: number;
  readonly evidence: string;
  readonly source: string;
}

/** Youngest first. Days per year turn into hours as 8766 hours (a year) over the count. */
export const DAY_MEASUREMENTS: readonly DayMeasurement[] = [
  {
    ma: 0,
    hours: 24,
    uncertainty: null,
    daysPerYear: 365.25,
    evidence: 'today',
    source: 'IERS',
  },
  {
    ma: 70,
    hours: 23.5,
    uncertainty: null,
    daysPerYear: 372,
    evidence: 'daily layers in a rudist shell (Oman)',
    source: 'de Winter et al. 2020, Paleoceanography and Paleoclimatology 35',
  },
  {
    ma: 390,
    hours: 21.9,
    uncertainty: null,
    daysPerYear: 400,
    evidence: 'daily growth lines on Devonian corals',
    source: 'Wells 1963, Nature 197',
  },
  {
    ma: 620,
    hours: 21.9,
    uncertainty: 0.4,
    daysPerYear: 400,
    evidence: 'tidal rhythmites (South Australia)',
    source: 'Williams 2000, Reviews of Geophysics 38',
  },
];

/**
 * The measurements on either side of `ma` (0 or older): the nearest younger, which is today
 * at worst, and the nearest strictly older if there is one.
 */
export function dayMeasurementsAround(ma: number): {
  readonly younger: DayMeasurement;
  readonly older: DayMeasurement | null;
} {
  const younger =
    DAY_MEASUREMENTS.findLast((measurement) => measurement.ma <= ma) ??
    elementAt(DAY_MEASUREMENTS, 0);
  const older = DAY_MEASUREMENTS.find((measurement) => measurement.ma > ma) ?? null;
  return { younger, older };
}

/** Axial tilt: today's value and the range it cycles through. */
export const TILT = {
  today: 23.44,
  min: 22.1,
  max: 24.5,
  /** Years per cycle today; the cycle was shorter when the Moon was nearer. */
  periodYears: 41_000,
  source: 'Laskar et al. 2004; Laskar, Joutel & Robutel 1993',
} as const;
