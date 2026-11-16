/**
 * The ozone layer's story since 1979 (#722), as `ozone/history.json` has it (the pipeline's
 * `ozone-history`): each spring's Antarctic ozone hole (NASA Ozone Watch: its mean area inside
 * 220 Dobson units and its mean daily minimum), and the ozone-depleting gases over Antarctica
 * (the NOAA Ozone Depleting Gas Index: equivalent effective stratospheric chlorine and the
 * index, 100 at its peak). A year the satellites missed (1995) is missing, never filled.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';

const year = v.pipe(v.number(), v.integer());
const text = v.pipe(v.string(), v.minLength(1));

const OzoneSchema = v.strictObject({
  schemaVersion: v.literal(1),
  hole: v.strictObject({
    credit: text,
    source: v.pipe(v.string(), v.url()),
    licence: text,
    columns: v.tuple([v.literal('year'), v.literal('areaMkm2'), v.literal('minimumDU')]),
    area: text,
    minimum: text,
    missing: v.array(year),
    rows: v.array(v.tuple([year, v.nullable(v.number()), v.nullable(v.number())])),
  }),
  gases: v.strictObject({
    credit: text,
    source: v.pipe(v.string(), v.url()),
    licence: text,
    columns: v.tuple([v.literal('year'), v.literal('eescPpt'), v.literal('odgi')]),
    index: text,
    antarctic: v.array(v.tuple([year, v.number(), v.number()])),
    midlatitude: v.array(v.tuple([year, v.number(), v.number()])),
  }),
});

export type OzoneHistory = v.InferOutput<typeof OzoneSchema>;

export async function loadOzone(url: string, fetchJson: Fetch): Promise<OzoneHistory> {
  return getJson(fetchJson, url, OzoneSchema);
}

/** The Montreal Protocol on substances that deplete the ozone layer: signed 16 September 1987. */
export const MONTREAL_YEAR = 1987;

/** One spring's hole: its mean area (million km²) and mean minimum (Dobson units). */
interface Hole {
  readonly year: number;
  readonly areaMkm2: number;
  readonly minimumDU: number;
}

/** What the record says of a year: its hole, a year it has no measurement for, or none. */
export type HoleYear =
  | { readonly kind: 'hole'; readonly hole: Hole }
  | { readonly kind: 'missing'; readonly year: number }
  | { readonly kind: 'outside'; readonly first: number; readonly last: number };

/** The year's hole, if the record has one. */
export function holeIn(history: OzoneHistory, at: number): HoleYear {
  const { rows } = history.hole;
  const first = rows[0]?.[0] ?? 0;
  const last = rows.at(-1)?.[0] ?? 0;
  const row = rows.find(([each]) => each === at);
  if (row === undefined) return { kind: 'outside', first, last };
  const [, areaMkm2, minimumDU] = row;
  if (areaMkm2 === null || minimumDU === null) return { kind: 'missing', year: at };
  return { kind: 'hole', hole: { year: at, areaMkm2, minimumDU } };
}

/** Earth's mean radius, km. */
const EARTH_KM = 6371;

/**
 * The latitude a cap round the South Pole of `areaMkm2` reaches: the hole drawn as a cap of its
 * mean area, not its shape, which wanders and stretches off the pole.
 */
export function capEdgeLatitude(areaMkm2: number): number {
  const sphere = 4 * Math.PI * EARTH_KM ** 2;
  const fraction = Math.min(1, (areaMkm2 * 1e6) / sphere);
  // A cap's area is 2πR²(1 − cos θ): θ from the pole.
  const theta = Math.acos(1 - 2 * fraction);
  return -90 + (theta * 180) / Math.PI;
}

/** What the layer says of a year, in a line. */
export function ozoneText(history: OzoneHistory, at: number): string {
  const found = holeIn(history, at);
  if (found.kind === 'outside') {
    return `The ozone hole’s record runs from ${String(found.first)} to ${String(found.last)}: nothing for this year.`;
  }
  if (found.kind === 'missing') {
    return `No satellite measured the ozone hole in ${String(found.year)}: left empty, not filled.`;
  }
  return `${ozoneWords(history, at)} Drawn as a cap of that area round the pole, not its shape.`;
}

/** What the record says of a year's hole, however it is drawn. */
export function ozoneWords(history: OzoneHistory, at: number): string {
  const found = holeIn(history, at);
  if (found.kind === 'outside') {
    return `NASA’s record of the hole runs from ${String(found.first)} to ${String(found.last)}.`;
  }
  if (found.kind === 'missing') {
    return `No satellite measured the hole day by day in ${String(found.year)}: NASA’s record leaves it empty.`;
  }
  const { areaMkm2, minimumDU } = found.hole;
  return `The Antarctic ozone hole in the spring of ${String(at)}: ${areaMkm2.toFixed(1)} million km² on average, its lowest ozone ${String(Math.round(minimumDU))} Dobson units.`;
}

/** The year in a few words, for the chart's panel. */
export function ozoneLine(history: OzoneHistory, at: number): string {
  const found = holeIn(history, at);
  if (found.kind === 'outside') {
    return `${String(at)}: outside NASA’s record of the hole, ${String(found.first)} to ${String(found.last)}.`;
  }
  if (found.kind === 'missing') return `${String(at)}: not measured.`;
  const { areaMkm2, minimumDU } = found.hole;
  return `${String(at)}: ${areaMkm2.toFixed(1)} million km², lowest ${String(Math.round(minimumDU))} DU.`;
}
