/**
 * Land or sea at a place, read from today's coasts and shelves (`data/shelf.ts`): ETOPO1's
 * elevation, one metre a byte from `lowest`, on a node-registered grid of `columns` from 180° W
 * to 180° E and `rows` from 90° N to 90° S. Above today's sea level is land.
 */

import type { GeoPoint } from '../state/viewState';
import { valueAt } from '../util/arrays';

export interface ElevationGrid {
  /** One byte a node, row by row from the north. */
  readonly values: ArrayLike<number>;
  readonly columns: number;
  readonly rows: number;
  /** The elevation, metres, a byte of 0 stands for. */
  readonly lowest: number;
}

/** The elevation at a place, metres, at its nearest node; clipped to the band the grid holds. */
export function elevationAt(grid: ElevationGrid, place: GeoPoint): number {
  const longitude = ((((place.longitude + 180) % 360) + 360) % 360) - 180;
  const column = Math.round(((longitude + 180) / 360) * (grid.columns - 1));
  const row = Math.round(((90 - place.latitude) / 180) * (grid.rows - 1));
  const clampedRow = Math.min(grid.rows - 1, Math.max(0, row));
  return grid.lowest + valueAt(grid.values, clampedRow * grid.columns + column);
}

/** Whether a place is above today's sea level. */
export function onLand(grid: ElevationGrid, place: GeoPoint): boolean {
  return elevationAt(grid, place) > 0;
}
