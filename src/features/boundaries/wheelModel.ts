/**
 * The planetary boundaries' wheel as the layer draws it beside the globe (#434): flat, in SVG,
 * small enough for the column of panels. Each of the nine boundaries has a ninth of the circle,
 * shared by its control variables; each variable's wedge reaches from the reference ring (0)
 * through the boundary (1) and the high-risk line (2), coloured by the zone each part lies in.
 * Ranges and judgements are drawn faded past their sure part, as the 3D wheel draws them. With
 * a second assessment, a pale bar in each wedge shows its value.
 *
 * Pure: the paths and words, no DOM.
 */

import {
  MAX_REACH,
  statusOf,
  transgressedCount,
  variableReach,
  zoneOf,
  type AssessmentId,
  type BoundaryId,
  type PlanetaryBoundaries,
  type Status,
  type Zone,
} from '../../data/planetaryBoundaries';

/** The wheel's box is this wide and high; its centre is in the middle. */
export const WHEEL_SIZE = 200;
const CENTRE = WHEEL_SIZE / 2;
/** Each boundary's share of the circle, and the gap between wedges, radians. */
const SECTOR = (2 * Math.PI) / 9;
const GAP = 0.04;

/** The radius of a reach: the reference ring sits round the hub, the furthest near the edge. */
export function radiusOf(reach: number): number {
  return 26 + reach * 22;
}

/** A point at `radius` and `angle`, clockwise from the top. */
function point(radius: number, angle: number): string {
  const x = CENTRE + radius * Math.sin(angle);
  const y = CENTRE - radius * Math.cos(angle);
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

/** A piece of a ring, from radius `inner` to `outer`, between two angles clockwise from the top. */
export function ringPiece(inner: number, outer: number, from: number, to: number): string {
  const large = to - from > Math.PI ? 1 : 0;
  return [
    `M${point(inner, from)}`,
    `L${point(outer, from)}`,
    `A${outer.toFixed(2)} ${outer.toFixed(2)} 0 ${String(large)} 1 ${point(outer, to)}`,
    `L${point(inner, to)}`,
    `A${inner.toFixed(2)} ${inner.toFixed(2)} 0 ${String(large)} 0 ${point(inner, from)}`,
    'Z',
  ].join(' ');
}

/** One part of a wedge: its path, the zone it lies in, and whether it is sure or faded. */
interface WedgePart {
  readonly d: string;
  readonly zone: Zone;
  readonly faded: boolean;
}

/** One boundary as drawn: its wedges' parts, the other assessment's bars, and where it is. */
interface WheelBoundary {
  readonly id: BoundaryId;
  readonly name: string;
  /** Its status in the assessment drawn; null if that assessment had none of its variables. */
  readonly status: Status | null;
  readonly parts: readonly WedgePart[];
  /** The other assessment's values, as pale bars; none unless asked to compare. */
  readonly bars: readonly string[];
  /** The whole of its sector, to pick it by. */
  readonly sector: string;
}

export interface Wheel {
  readonly boundaries: readonly WheelBoundary[];
  /** The rings' radii: the reference, the boundary and the high-risk line. */
  readonly rings: {
    readonly reference: number;
    readonly boundary: number;
    readonly highRisk: number;
  };
  /** How many of the nine the assessment finds crossed. */
  readonly crossed: number;
}

/** The parts of a wedge from the reference to `to`, cut where it crosses a ring. */
function zoneParts(
  from: number,
  to: number,
  between: readonly [number, number],
  faded: boolean,
): WedgePart[] {
  const cuts: readonly (readonly [number, number])[] = [
    [0, 1],
    [1, 2],
    [2, MAX_REACH],
  ];
  return cuts.flatMap(([low, high]) => {
    const start = Math.max(from, low);
    const end = Math.min(to, high);
    if (end <= start) return [];
    return [
      {
        d: ringPiece(radiusOf(start), radiusOf(end), between[0], between[1]),
        zone: zoneOf((start + end) / 2),
        faded,
      },
    ];
  });
}

/** The smallest reach a wedge is drawn to, so one at its reference still shows. */
const LEAST = 0.06;

/**
 * The wheel for `assessment`, with `compare`'s values as pale bars when given. Each assessment
 * is placed against its own boundaries, as each drew its own diagram.
 */
export function wheelOf(
  data: PlanetaryBoundaries,
  assessment: AssessmentId,
  compare: AssessmentId | null,
): Wheel {
  const boundaries = data.boundaries.map((boundary, index): WheelBoundary => {
    const start = index * SECTOR - SECTOR / 2;
    const share = SECTOR / boundary.variables.length;
    const parts: WedgePart[] = [];
    const bars: string[] = [];
    boundary.variables.forEach((variable, which) => {
      const from = start + which * share + GAP / 2;
      const to = start + (which + 1) * share - GAP / 2;
      const now = variableReach(variable, assessment);
      if (now !== null) {
        // Sure up to its lower value; a range, or a judgement, faded past it.
        const certain = now.judged ? Math.min(now.low, 2) : now.low;
        const far = Math.max(now.high ?? MAX_REACH, now.low);
        parts.push(...zoneParts(0, Math.max(certain, LEAST), [from, to], false));
        if (now.judged || far > now.low) parts.push(...zoneParts(certain, far, [from, to], true));
      }
      const then = compare === null ? null : variableReach(variable, compare);
      if (then !== null) {
        // A narrow bar down the middle of the wedge.
        const middle = (from + to) / 2;
        const half = Math.min((to - from) / 6, 0.05);
        bars.push(
          ringPiece(radiusOf(0), radiusOf(Math.max(then.low, LEAST)), middle - half, middle + half),
        );
      }
    });
    return {
      id: boundary.id,
      name: boundary.name,
      status: statusOf(boundary, assessment),
      parts,
      bars,
      sector: ringPiece(radiusOf(0) - 4, radiusOf(MAX_REACH), start, start + SECTOR),
    };
  });
  return {
    boundaries,
    rings: { reference: radiusOf(0), boundary: radiusOf(1), highRisk: radiusOf(2) },
    crossed: transgressedCount(data, assessment),
  };
}

/** The assessment the year shown reads: the latest made by then, or none before the first. */
export function assessmentIn(year: number): AssessmentId | null {
  if (year >= 2026) return 'phc2026';
  if (year >= 2023) return 'richardson2023';
  return null;
}
