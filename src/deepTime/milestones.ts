/**
 * Milestones of Earth's history, from the Solar System's first solids to our species. Where the literature disagrees, each position is
 * an estimate of its own, with its source and the evidence it rests on; none is chosen over
 * the others. Ages are ranges (min to max, Ma); a point has min equal to max.
 *
 * `basis` says how firm the numbers are:
 * - `stated`: the source gives the number;
 * - `stage`: the source names a geological stage, and the range is that stage's on the ICS
 *   chart v2026/06;
 * - `secondary`: the number is the source's, as quoted by a later paper.
 *
 * The milestones are in milestones.json; the check that each has the right shape is in
 * milestones.test.ts.
 */

import milestonesJson from './milestones.json' with { type: 'json' };

export const MILESTONE_KINDS = [
  'cosmos',
  'life',
  'extinction',
  'continents',
  'climate',
  'humans',
] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];
export const BASES = ['stated', 'stage', 'secondary'] as const;
export type Basis = (typeof BASES)[number];

interface Estimate {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly basis: Basis;
  readonly source: string;
  readonly url: string;
}

export interface Milestone {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly kind: MilestoneKind;
  /** Where the estimates differ partly because they measure different things. */
  readonly note?: string;
  readonly estimates: readonly Estimate[];
}

// The milestones themselves are content, kept in milestones.json (#383); milestones.test.ts
// checks each one's shape.
/** Oldest first, by anchor. */
export const MILESTONES = milestonesJson as readonly Milestone[];

/**
 * Where a milestone sits on the time line: the oldest edge of any estimate, where the earliest
 * proposal comes in. Playing on from there passes every other one, so none is favoured.
 */
export function anchorMa(milestone: Milestone): number {
  return Math.max(...milestone.estimates.map(({ max }) => max));
}

/** Milestones with an estimate within `reach` Ma of `ma`, oldest first. */
export function milestonesNear(ma: number, reach: number): readonly Milestone[] {
  // Oldest first, as the time line runs from earlier to later.
  return MILESTONES.filter(({ estimates }) =>
    estimates.some(({ min, max }) => ma >= min - reach && ma <= max + reach),
  ).toSorted((a, b) => anchorMa(b) - anchorMa(a));
}

/**
 * A milestone this close to `ma` is the one the view stands on, not the next: a link rounded
 * to a tenth of a million years (as older links were) still lands on it.
 */
export const STANDING_MA = 0.05;

/**
 * The next milestone towards the present (direction −1) or the past (+1) from `ma`, among
 * those no older than `oldest` (the span the bar shows).
 */
export function nextMilestone(ma: number, direction: 1 | -1, oldest = Infinity): Milestone | null {
  const shown = MILESTONES.filter((milestone) => anchorMa(milestone) <= oldest);
  return direction < 0
    ? (shown.find((milestone) => anchorMa(milestone) < ma - STANDING_MA) ?? null)
    : (shown.findLast((milestone) => anchorMa(milestone) > ma + STANDING_MA) ?? null);
}
