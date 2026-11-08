/**
 * Each impact's path through time (#304): where its crater lay at every step from its strike to
 * today, on the PALEOMAP reconstruction, as the globe draws it (`placeThen`). Pure, so the 3D
 * sheet (`ui/impactPathsSheet.ts`) only has to draw what this says.
 */

import type { GeoPoint } from '../state/viewState';
import { placeThen, strikeMa, type Impact, type Impacts } from './impacts';

/** A place on a path: where the crater lay `ma` million years ago. */
export interface PathPoint extends GeoPoint {
  readonly ma: number;
}

export interface ImpactPath {
  readonly impact: Impact;
  /** Where the path starts, Ma: its strike, or as far back as the reconstruction reaches. */
  readonly fromMa: number;
  /** Dated to within `WIDE_SPAN_MA` (strikeMa); otherwise drawn from the middle of its span. */
  readonly tight: boolean;
  /** Struck before the reconstruction reaches: only the part since then is drawn. */
  readonly beyondReach: boolean;
  /**
   * The path in unbroken runs, oldest first: it breaks where the crater lay on no plate, and
   * where it crosses the antimeridian, so no run draws a line across the whole map.
   */
  readonly runs: readonly (readonly PathPoint[])[];
}

/** How far back the reconstruction places craters, Ma: its last step. */
export function pathsReach(data: Impacts): number {
  let steps = 0;
  for (const impact of data.impacts) steps = Math.max(steps, impact.then.length);
  return (steps - 1) * data.stepMa;
}

/** One impact's path, or null when it is undated or has no place at all. */
export function impactPath(
  data: Impacts,
  impact: Impact,
  reach = pathsReach(data),
): ImpactPath | null {
  const { olderMa, youngerMa } = impact;
  if (olderMa === null || youngerMa === null) return null;
  const strike = strikeMa(impact);
  const struck = strike ?? (olderMa + youngerMa) / 2;
  const fromMa = Math.min(struck, reach);
  // Its strike, then every step of the reconstruction younger than it, to today.
  const times = [fromMa];
  for (let step = Math.ceil(fromMa / data.stepMa) - 1; step >= 0; step--) {
    const ma = step * data.stepMa;
    if (ma < fromMa) times.push(ma);
  }
  const runs: PathPoint[][] = [];
  let run: PathPoint[] = [];
  for (const ma of times) {
    const point = placeThen(data, impact, ma);
    const last = run.at(-1);
    if (
      point === null ||
      (last !== undefined && Math.abs(point.longitude - last.longitude) > 180)
    ) {
      if (run.length > 0) runs.push(run);
      run = [];
    }
    if (point !== null) run.push({ ...point, ma });
  }
  if (run.length > 0) runs.push(run);
  if (runs.length === 0) return null;
  return { impact, fromMa, tight: strike !== null, beyondReach: struck > reach, runs };
}

/** Every impact's path that can be drawn, largest crater first. */
export function impactPaths(data: Impacts): readonly ImpactPath[] {
  const reach = pathsReach(data);
  return data.impacts
    .map((impact) => impactPath(data, impact, reach))
    .filter((path): path is ImpactPath => path !== null)
    .sort((a, b) => (b.impact.diameterKm ?? 0) - (a.impact.diameterKm ?? 0));
}

const EARTH_KM = 6371;

/** How far a path's crater travelled with its plate, km, along the reconstruction's steps. */
export function pathKm(path: ImpactPath): number {
  let km = 0;
  for (const run of path.runs) {
    for (let at = 1; at < run.length; at++) {
      const a = run[at - 1];
      const b = run[at];
      if (a === undefined || b === undefined) continue;
      km += greatCircleKm(a, b);
    }
  }
  return km;
}

function greatCircleKm(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
