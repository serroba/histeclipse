/**
 * Where the plates met, every 5 million years back to 1,800 Ma (`public/data/plate-boundaries/`,
 * #1160): Cao et al. (2024, CC BY 4.0), resolved with pyGPlates by the `data-pipeline/plates`
 * project's `histeclipse-plate-boundaries`. Each frame holds its boundaries by kind: ridges
 * (and rifts) where plates part, subduction zones where one sinks under another, transforms
 * where they slide past, and the rest.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';
import { HEADER_ADDED } from './header';

export const BOUNDARY_KINDS = ['ridge', 'subduction', 'transform', 'other'] as const;
export type BoundaryKind = (typeof BOUNDARY_KINDS)[number];

const IndexSchema = v.strictObject({
  schemaVersion: v.literal(1),
  ...HEADER_ADDED,
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  stepMa: v.pipe(v.number(), v.integer(), v.minValue(1)),
  oldestMa: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export type BoundaryIndex = v.InferOutput<typeof IndexSchema>;

/** Lines as flat [lon, lat, lon, lat, …], degrees: two points at least. */
const Lines = v.array(
  v.pipe(
    v.array(v.number()),
    v.check((line) => line.length >= 4 && line.length % 2 === 0, 'lines are lon/lat pairs'),
  ),
);

const FrameSchema = v.strictObject({
  ma: v.pipe(v.number(), v.integer(), v.minValue(0)),
  lines: v.strictObject({ ridge: Lines, subduction: Lines, transform: Lines, other: Lines }),
});

type Point = readonly [number, number];
type BoundaryLine = readonly Point[];

/** One time's boundaries, by kind, each a line of [lon, lat] points. */
export interface BoundaryFrame {
  readonly ma: number;
  readonly lines: Readonly<Record<BoundaryKind, readonly BoundaryLine[]>>;
}

export async function loadBoundaryIndex(url: string, fetchJson: Fetch): Promise<BoundaryIndex> {
  return getJson(fetchJson, url, IndexSchema);
}

function pairs(flat: readonly number[]): BoundaryLine {
  const points: Point[] = [];
  for (let index = 0; index + 1 < flat.length; index += 2) {
    points.push([flat[index] ?? 0, flat[index + 1] ?? 0]);
  }
  return points;
}

type ByKind = Readonly<Record<BoundaryKind, readonly BoundaryLine[]>>;

/** Each kind's lines, as `of` makes them. */
function byKind(of: (kind: BoundaryKind) => readonly BoundaryLine[]): ByKind {
  return {
    ridge: of('ridge'),
    subduction: of('subduction'),
    transform: of('transform'),
    other: of('other'),
  };
}

export async function loadBoundaryFrame(url: string, fetchJson: Fetch): Promise<BoundaryFrame> {
  const raw = await getJson(fetchJson, url, FrameSchema);
  return { ma: raw.ma, lines: byKind((kind) => raw.lines[kind].map(pairs)) };
}

/** The frame, Ma, nearest `ma`, or null beyond the oldest. */
export function boundaryFrameMa(index: BoundaryIndex, ma: number): number | null {
  if (ma < 0 || ma > index.oldestMa) return null;
  return Math.min(index.oldestMa, Math.round(ma / index.stepMa) * index.stepMa);
}

/** Longitude turned east by `turn` degrees, back within −180° to 180°. */
function turned(lon: number, turn: number): number {
  return ((((lon + turn + 180) % 360) + 360) % 360) - 180;
}

/**
 * A frame's lines turned east about the axis by `turn` degrees: as the continent masks are, to
 * line the model up with the surface map (rock magnetism fixes latitude, not longitude).
 */
export function turnedFrame(frame: BoundaryFrame, turn: number): BoundaryFrame {
  if (turn === 0) return frame;
  const turnLine = (line: BoundaryLine): BoundaryLine =>
    line.map(([lon, lat]): Point => [turned(lon, turn), lat]);
  return { ma: frame.ma, lines: byKind((kind) => frame.lines[kind].map(turnLine)) };
}
