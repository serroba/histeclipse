/**
 * Where four groups of animals lived (`public/data/fossils.json`), from the Paleobiology
 * Database (CC BY 4.0) by the pipeline's `fossils` command: occurrences counted by 5-million-
 * year step and 5° cell, each at its place at that age on the PALEOMAP reconstruction, the
 * model behind the deep-time surface maps.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from './fetchJson';

const integer = v.pipe(v.number(), v.integer());

const FossilsSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  stepMa: v.pipe(v.number(), v.gtValue(0)),
  cellDegrees: v.pipe(v.number(), v.gtValue(0)),
  groups: v.array(
    v.strictObject({
      id: v.picklist(['trilobites', 'ammonoids', 'dinosaurs', 'mammals']),
      name: v.pipe(v.string(), v.minLength(1)),
      occurrences: v.pipe(integer, v.minValue(0)),
      /** Each: step's start (Ma), cell's south edge, west edge, count. */
      counts: v.array(v.tuple([integer, integer, integer, v.pipe(integer, v.minValue(1))])),
    }),
  ),
});

export type Fossils = v.InferOutput<typeof FossilsSchema>;
export type FossilGroup = Fossils['groups'][number]['id'];

export async function loadFossils(url: string, fetchJson: Fetch): Promise<Fossils> {
  return getJson(fetchJson, url, FossilsSchema);
}

/** A cell with finds of one group, at its centre. */
export interface FossilCell {
  readonly group: FossilGroup;
  readonly latitude: number;
  readonly longitude: number;
  readonly count: number;
}

export interface FossilsAt {
  /** The step counted: from `from` to `to` million years ago. */
  readonly from: number;
  readonly to: number;
  readonly cells: readonly FossilCell[];
  /** Finds in the step, per group, in the file's order. */
  readonly totals: readonly {
    readonly id: FossilGroup;
    readonly name: string;
    readonly count: number;
  }[];
}

/** The finds of the 5-million-year step holding `ma`, most first. */
export function fossilsAt(data: Fossils, ma: number): FossilsAt {
  const to = Math.floor(ma / data.stepMa) * data.stepMa;
  const half = data.cellDegrees / 2;
  const cells: FossilCell[] = [];
  const totals = data.groups.map((group) => {
    let count = 0;
    for (const [step, south, west, found] of group.counts) {
      if (step !== to) continue;
      count += found;
      cells.push({ group: group.id, latitude: south + half, longitude: west + half, count: found });
    }
    return { id: group.id, name: group.name, count };
  });
  return { from: to + data.stepMa, to, cells: cells.sort((a, b) => b.count - a.count), totals };
}

/** What the bar says of the step's finds. */
export function fossilsText(at: FossilsAt): string {
  const found = at.totals.filter((total) => total.count > 0);
  const step = `${String(at.from)}–${String(at.to)} million years ago`;
  if (found.length === 0) return `Fossils, ${step}: none of these groups found.`;
  const list = found
    .map((total) => `${total.name} ${total.count.toLocaleString('en')}`)
    .join(' · ');
  return `Fossils, ${step}, where they lay then: ${list}. Counts show where fossils have been found and recorded, not how many animals lived.`;
}
