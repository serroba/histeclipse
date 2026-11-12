/**
 * The nine Planetary Boundaries (`public/data/planetary-boundaries.json`, #434): each boundary's
 * control variables, with the values of two assessments, the Planetary Health Check 2026 and
 * Richardson et al. (2023), as the 2026 report's Table 7.1 gives them.
 *
 * Each value is placed on one scale for drawing, its reach: 0 at the variable's reference value
 * (Holocene-like or pre-industrial), 1 at its boundary, 2 at its high-risk line, beyond that
 * eased towards `MAX_REACH` so the strongest transgressions stay in view. Each assessment is
 * placed against its own boundaries, as each drew its own diagram.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';

/** Where a reach eases to, beyond the high-risk line. */
export const MAX_REACH = 3.2;

const value = v.number();

const ValuesSchema = v.union([
  v.strictObject({
    current: v.strictObject({ low: value, high: v.nullable(value) }),
    /** Null where the report gives none (a proposed boundary): drawn from zero. */
    reference: v.nullable(value),
    boundary: value,
    highRisk: value,
  }),
  // A variable with no numbers beyond its boundary: the report places it in a zone by judgement.
  v.strictObject({
    current: v.null(),
    placed: v.picklist(['increasing', 'high']),
    reference: value,
    boundary: value,
    highRisk: v.null(),
  }),
]);

const AssessmentId = v.picklist(['phc2026', 'richardson2023']);

const BoundariesSchema = v.strictObject({
  schemaVersion: v.literal(1),
  about: v.pipe(v.string(), v.minLength(1)),
  assessments: v.array(
    v.strictObject({
      id: AssessmentId,
      name: v.pipe(v.string(), v.minLength(1)),
      short: v.pipe(v.string(), v.minLength(1)),
      source: v.pipe(v.string(), v.minLength(1)),
    }),
  ),
  boundaries: v.pipe(
    v.array(
      v.strictObject({
        id: v.pipe(v.string(), v.regex(/^[a-z]+$/)),
        name: v.pipe(v.string(), v.minLength(1)),
        /** The report's own word for its 2026 status. */
        stated: v.picklist(['within', 'transgressed', 'strongly']),
        summary: v.pipe(v.string(), v.minLength(1)),
        variables: v.pipe(
          v.array(
            v.strictObject({
              id: v.pipe(v.string(), v.regex(/^[a-zA-Z0-9]+$/)),
              name: v.pipe(v.string(), v.minLength(1)),
              unit: v.pipe(v.string(), v.minLength(1)),
              /** Whether more of it is worse (CO₂) or less of it is (forest cover). */
              direction: v.picklist(['up', 'down']),
              /** Spread on a log scale (extinction rates, by tens), or a linear one. */
              scale: v.picklist(['linear', 'log']),
              /** A proposed regional boundary: drawn, but not counted in the status. */
              proposed: v.optional(v.literal(true)),
              note: v.optional(v.pipe(v.string(), v.minLength(1))),
              values: v.strictObject({
                phc2026: ValuesSchema,
                richardson2023: v.optional(ValuesSchema),
              }),
            }),
          ),
          v.minLength(1),
        ),
      }),
    ),
    v.length(9),
  ),
});

export type PlanetaryBoundaries = v.InferOutput<typeof BoundariesSchema>;
export type Boundary = PlanetaryBoundaries['boundaries'][number];
export type ControlVariable = Boundary['variables'][number];
export type AssessmentId = v.InferOutput<typeof AssessmentId>;

export async function loadPlanetaryBoundaries(
  url: string,
  fetchJson: Fetch,
): Promise<PlanetaryBoundaries> {
  return getJson(fetchJson, url, BoundariesSchema);
}

/** The zones a reach falls in: inside the boundary, past it, or past the high-risk line. */
export type Zone = 'safe' | 'increasing' | 'high';

export function zoneOf(reach: number): Zone {
  // At the boundary is still inside it; at the high-risk value is in the high-risk zone.
  return reach <= 1 ? 'safe' : reach < 2 ? 'increasing' : 'high';
}

/** Where `x` lies from `from` (0) to `to` (1), on the variable's scale. */
function along(scale: ControlVariable['scale'], x: number, from: number, to: number): number {
  if (scale === 'log') return Math.log(x / from) / Math.log(to / from);
  return (x - from) / (to - from);
}

/** Beyond the high-risk line, `beyond` high-risk spans further: eased towards `MAX_REACH`. */
function eased(beyond: number): number {
  return 2 + (MAX_REACH - 2) * (1 - Math.exp(-beyond));
}

/**
 * How far `x` reaches on the drawing's scale, for a variable with numbers: 0 at the reference,
 * 1 at the boundary, 2 at the high-risk line, then eased; never below 0.
 */
export function reachOf(
  variable: Pick<ControlVariable, 'scale'>,
  values: {
    readonly reference: number | null;
    readonly boundary: number;
    readonly highRisk: number;
  },
  x: number,
): number {
  const reference = values.reference ?? 0;
  const { boundary, highRisk } = values;
  const { scale } = variable;
  // Past the boundary, measured from it towards the high-risk line, whichever way is worse.
  const pastBoundary = along(scale, x, boundary, highRisk);
  if (pastBoundary > 1) return eased(pastBoundary - 1);
  if (pastBoundary > 0) return 1 + pastBoundary;
  return Math.max(0, along(scale, x, reference, boundary));
}

/** Where a variable stands in an assessment: from and to (a range), and how sure. */
export interface Reach {
  readonly low: number;
  /** The far end of a range; null where the report gives only a lower bound (“more than”). */
  readonly high: number | null;
  /** Placed by the report's judgement, with no numbers beyond the boundary: drawn blurred. */
  readonly judged: boolean;
}

/** Where a variable stands in an assessment, or null when that assessment did not have it. */
export function variableReach(variable: ControlVariable, assessment: AssessmentId): Reach | null {
  const values = variable.values[assessment];
  if (values === undefined) return null;
  if (values.current === null) {
    // Placed in a zone by judgement: drawn halfway into it.
    const reach = values.placed === 'high' ? eased(0.7) : 1.5;
    return { low: reach, high: reach, judged: true };
  }
  const { low, high } = values.current;
  return {
    low: reachOf(variable, values, low),
    high: high === null ? null : reachOf(variable, values, high),
    judged: false,
  };
}

/** How a boundary stands: within it, past it, or a variable past the high-risk line. */
export type Status = 'within' | 'transgressed' | 'strongly';

/** A boundary's status in an assessment, from its variables (proposed ones aside); null if none. */
export function statusOf(boundary: Boundary, assessment: AssessmentId): Status | null {
  const reaches = boundary.variables
    .filter((variable) => variable.proposed !== true)
    .map((variable) => variableReach(variable, assessment))
    .filter((reach) => reach !== null);
  if (reaches.length === 0) return null;
  const furthest = Math.max(...reaches.map((reach) => reach.low));
  return zoneOf(furthest) === 'high'
    ? 'strongly'
    : zoneOf(furthest) === 'increasing'
      ? 'transgressed'
      : 'within';
}

/** How many of the nine boundaries an assessment finds transgressed. */
export function transgressedCount(data: PlanetaryBoundaries, assessment: AssessmentId): number {
  return data.boundaries.filter((boundary) => {
    const status = statusOf(boundary, assessment);
    return status === 'transgressed' || status === 'strongly';
  }).length;
}

/** A value as the report writes it: a range, “more than”, or one number, with its unit. */
export function valueText(variable: ControlVariable, assessment: AssessmentId): string | null {
  const values = variable.values[assessment];
  if (values === undefined) return null;
  if (values.current === null) {
    return values.placed === 'high' ? 'high-risk zone (not quantified)' : 'past the boundary';
  }
  const number = (x: number): string => x.toLocaleString('en', { maximumFractionDigits: 3 });
  const { low, high } = values.current;
  const shown =
    high === null
      ? `more than ${number(low)}`
      : low === high
        ? number(low)
        : `${number(low)}–${number(high)}`;
  return `${shown} ${variable.unit}`;
}
