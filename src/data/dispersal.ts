/**
 * When people first settled each place, as one model has it (`public/data/dispersal/`):
 * Timmermann & Friedrich (2016), CC BY-NC 4.0, packed by the pipeline's `dispersal` command.
 * Each scenario is a 1° greyscale map, a byte per cell: the arrival in thousands of years ago,
 * 0 where the model never settles. One model's view, shown beside the dated finds.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from './fetchJson';

const IndexSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  license: v.literal('CC BY-NC 4.0'),
  rows: v.pipe(v.number(), v.integer(), v.minValue(1)),
  columns: v.pipe(v.number(), v.integer(), v.minValue(1)),
  scenarios: v.array(
    v.strictObject({
      id: v.picklist(['a', 'b']),
      name: v.pipe(v.string(), v.minLength(1)),
      file: v.pipe(v.string(), v.regex(/^arrival-[ab]\.png$/)),
    }),
  ),
});

export type DispersalIndex = v.InferOutput<typeof IndexSchema>;

export async function loadDispersalIndex(url: string, fetchJson: Fetch): Promise<DispersalIndex> {
  return getJson(fetchJson, url, IndexSchema);
}

/** A scenario's arrival times: a byte per cell, rows north to south from 179.5° W. */
export interface ArrivalGrid {
  readonly columns: number;
  readonly rows: number;
  readonly arrival: Uint8Array;
}

/** The share of the cells the model ever settles that are settled `ka` thousand years ago. */
export function settledShare(grid: ArrivalGrid, ka: number): number {
  let ever = 0;
  let settled = 0;
  for (const arrival of grid.arrival) {
    if (arrival === 0) continue;
    ever += 1;
    if (arrival >= ka) settled += 1;
  }
  return ever === 0 ? 0 : settled / ever;
}
