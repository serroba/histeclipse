/**
 * Where four groups of animals lived (`public/data/fossils.json`), from the Paleobiology
 * Database (CC BY 4.0) by the pipeline's `fossils` command: occurrences counted by 5-million-
 * year step and 5° cell, each at its place at that age on the PALEOMAP reconstruction, the
 * model behind the deep-time surface maps; each cell with its most-found genera.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from './fetchJson';
import { pictureFor, type Pictures } from './pictures';

const integer = v.pipe(v.number(), v.integer());

const FossilsSchema = v.strictObject({
  schemaVersion: v.literal(2),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  stepMa: v.pipe(v.number(), v.gtValue(0)),
  cellDegrees: v.pipe(v.number(), v.gtValue(0)),
  genera: v.array(v.pipe(v.string(), v.minLength(1))),
  /** The genera looked up on Wikipedia for the cards' pictures. */
  wikipedia: v.array(v.pipe(v.string(), v.minLength(1))),
  groups: v.array(
    v.strictObject({
      id: v.picklist(['trilobites', 'ammonoids', 'dinosaurs', 'mammals']),
      name: v.pipe(v.string(), v.minLength(1)),
      occurrences: v.pipe(integer, v.minValue(0)),
      /** Each: step's start (Ma), cell's south edge, west edge, count, genera found most. */
      counts: v.array(
        v.tuple([
          integer,
          integer,
          integer,
          v.pipe(integer, v.minValue(1)),
          /** Each: genus (an index into genera), times found. */
          v.array(v.tuple([v.pipe(integer, v.minValue(0)), v.pipe(integer, v.minValue(1))])),
        ]),
      ),
    }),
  ),
});

export type Fossils = v.InferOutput<typeof FossilsSchema>;
type FossilGroup = Fossils['groups'][number]['id'];

export async function loadFossils(url: string, fetchJson: Fetch): Promise<Fossils> {
  return getJson(fetchJson, url, FossilsSchema);
}

/** A cell with finds of one group, at its centre. */
export interface FossilCell {
  readonly group: FossilGroup;
  readonly latitude: number;
  readonly longitude: number;
  readonly count: number;
  /** Its most-found genera, with how many times, most first. */
  readonly genera: readonly (readonly [string, number])[];
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
    for (const [step, south, west, found, top] of group.counts) {
      if (step !== to) continue;
      count += found;
      cells.push({
        group: group.id,
        latitude: south + half,
        longitude: west + half,
        count: found,
        genera: top.map(([genus, times]) => [data.genera[genus] ?? '?', times] as const),
      });
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

/** A cell's card: its group's finds there then, its most-found genera, and the PBDB. */
export function fossilCard(
  data: Fossils,
  cell: FossilCell,
  at: FossilsAt,
  pictures: Pictures | null,
): {
  readonly title: string;
  readonly facts: readonly (readonly [string, string])[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
  readonly image?: { readonly src: string; readonly alt: string; readonly credit: string };
  readonly note: string;
} {
  const name = data.groups.find((group) => group.id === cell.group)?.name ?? cell.group;
  const half = data.cellDegrees / 2;
  const degrees = (value: number, positive: string, negative: string) =>
    `${String(Math.abs(value))}°${value < 0 ? negative : positive}`;
  const first = cell.genera[0]?.[0];
  const { image, links } = pictureFor(pictures, first, first ?? name);
  return {
    title: `${name}, ${String(at.from)}–${String(at.to)} million years ago`,
    facts: [
      ['Finds', cell.count.toLocaleString('en')],
      [
        'Where then',
        `${degrees(cell.latitude - half, 'N', 'S')}–${degrees(cell.latitude + half, 'N', 'S')}, ${degrees(cell.longitude - half, 'E', 'W')}–${degrees(cell.longitude + half, 'E', 'W')}, on the PALEOMAP reconstruction`,
      ],
      ...(cell.genera.length === 0
        ? []
        : [
            [
              'Found most',
              cell.genera.map(([genus, times]) => `${genus} ×${String(times)}`).join(', '),
            ] as const,
          ]),
    ],
    links: [
      ...cell.genera.map(([genus]) => ({
        label: `${genus} in the PBDB`,
        href: `https://paleobiodb.org/classic/checkTaxonInfo?taxon_name=${encodeURIComponent(genus)}`,
      })),
      ...links,
    ],
    ...(image === undefined ? {} : { image }),
    note: 'Where fossils have been found and recorded, not how many animals lived. Source: the Paleobiology Database (CC BY 4.0).',
  };
}
