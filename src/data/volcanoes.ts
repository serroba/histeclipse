/**
 * Volcanoes of the Holocene and their dated eruptions (`public/data/volcanoes.json`), from the
 * Smithsonian's Global Volcanism Program by the pipeline's `volcanoes` command, and, for the
 * cards, each volcano's geological summary and photo (`volcano-details.json`). Years are
 * astronomical; each eruption keeps the database's ± years, its VEI and how it was dated.
 */

import * as v from 'valibot';

import { astronomicalYear, formatYear } from '../time/year';
import type { GeoPoint } from '../state/viewState';
import { getJson, type Fetch } from './fetchJson';

const integer = v.pipe(v.number(), v.integer());

const VolcanoesSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  evidence: v.array(v.string()),
  volcanoes: v.array(
    v.strictObject({
      number: integer,
      name: v.pipe(v.string(), v.minLength(1)),
      kind: v.string(),
      country: v.string(),
      latitude: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
      longitude: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
      elevationM: v.nullable(integer),
      lastYear: v.nullable(integer),
    }),
  ),
  /** Each: volcano, start year, ± years, month, day, VEI (-1 unknown), confirmed (1), evidence. */
  eruptions: v.array(
    v.tuple([
      integer,
      integer,
      v.pipe(integer, v.minValue(0)),
      v.pipe(integer, v.minValue(0), v.maxValue(12)),
      v.pipe(integer, v.minValue(0), v.maxValue(31)),
      v.pipe(integer, v.minValue(-1), v.maxValue(8)),
      v.picklist([0, 1]),
      v.pipe(integer, v.minValue(-1)),
    ]),
  ),
});

const DetailsSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  volcanoes: v.record(
    v.string(),
    v.strictObject({
      summary: v.string(),
      photo: v.nullable(
        v.strictObject({
          src: v.pipe(v.string(), v.url(), v.startsWith('https://')),
          caption: v.string(),
          credit: v.string(),
        }),
      ),
    }),
  ),
});

export type Volcanoes = v.InferOutput<typeof VolcanoesSchema>;
export type Volcano = Volcanoes['volcanoes'][number];
export type VolcanoDetails = v.InferOutput<typeof DetailsSchema>;

export async function loadVolcanoes(url: string, fetchJson: Fetch): Promise<Volcanoes> {
  return getJson(fetchJson, url, VolcanoesSchema);
}

export async function loadVolcanoDetails(url: string, fetchJson: Fetch): Promise<VolcanoDetails> {
  return getJson(fetchJson, url, DetailsSchema);
}

/** An eruption, read from its row. */
export interface Eruption {
  readonly year: number;
  readonly uncertainty: number;
  readonly month: number;
  readonly day: number;
  readonly vei: number | null;
  readonly confirmed: boolean;
  readonly evidence: string | null;
}

/** A volcano marked at a year, with its eruptions near it. */
export interface VolcanoMark {
  readonly volcano: Volcano;
  readonly point: GeoPoint;
  readonly eruptions: readonly Eruption[];
  /** The largest VEI among them; null when none is known. */
  readonly vei: number | null;
  /** None of them is confirmed. */
  readonly uncertain: boolean;
}

/** How near the year shown an eruption's date must be, years, unless its own ± is wider. */
export const NEAR_YEARS = 25;

/**
 * The volcanoes with eruptions dated within `NEAR_YEARS` of `year`, or whose dating's ± reaches
 * it, largest VEI first.
 */
export function eruptionsNear(data: Volcanoes, year: number): readonly VolcanoMark[] {
  const byNumber = new Map(data.volcanoes.map((volcano) => [volcano.number, volcano]));
  const found = new Map<number, Eruption[]>();
  for (const [number, start, uncertainty, month, day, vei, confirmed, evidence] of data.eruptions) {
    if (Math.abs(year - start) > Math.max(NEAR_YEARS, uncertainty)) continue;
    const list = found.get(number) ?? [];
    list.push({
      year: start,
      uncertainty,
      month,
      day,
      vei: vei < 0 ? null : vei,
      confirmed: confirmed === 1,
      evidence: data.evidence[evidence] ?? null,
    });
    found.set(number, list);
  }
  const marks: VolcanoMark[] = [];
  for (const [number, eruptions] of found) {
    const volcano = byNumber.get(number);
    if (volcano === undefined) continue;
    const known = eruptions.flatMap((eruption) => (eruption.vei === null ? [] : [eruption.vei]));
    marks.push({
      volcano,
      point: { latitude: volcano.latitude, longitude: volcano.longitude },
      eruptions,
      vei: known.length === 0 ? null : Math.max(...known),
      uncertain: eruptions.every((eruption) => !eruption.confirmed),
    });
  }
  return marks.sort((a, b) => (b.vei ?? -1) - (a.vei ?? -1));
}

/** What the layer says of the eruptions near the year shown. */
export function volcanoesText(marks: readonly VolcanoMark[], year: number): string {
  const when = formatYear(astronomicalYear(year));
  if (marks.length === 0) {
    return `No eruptions dated within ${String(NEAR_YEARS)} years of ${when} in the Smithsonian’s Global Volcanism Program.`;
  }
  const largest = marks[0];
  const top =
    largest?.vei === null || largest === undefined
      ? ''
      : ` The largest: ${largest.volcano.name}, VEI ${String(largest.vei)}.`;
  return `${String(marks.length)} ${marks.length === 1 ? 'volcano' : 'volcanoes'} with eruptions dated within ${String(NEAR_YEARS)} years of ${when}, or whose dating’s ± reaches it, from the Smithsonian’s Global Volcanism Program.${top} VEI is the explosivity index, 0 to 8; paler, eruptions not confirmed.`;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** An eruption in a line: its date as the database knows it, size and how it is known. */
export function eruptionText(eruption: Eruption): string {
  const day = eruption.day > 0 ? `${String(eruption.day)} ` : '';
  const month = MONTHS[eruption.month - 1];
  const date = `${month === undefined ? '' : `${day}${month} `}${formatYear(astronomicalYear(eruption.year))}`;
  const plus = eruption.uncertainty > 0 ? ` ± ${String(eruption.uncertainty)} years` : '';
  const vei = eruption.vei === null ? 'VEI not known' : `VEI ${String(eruption.vei)}`;
  const dated = eruption.evidence === null ? '' : `; ${eruption.evidence}`;
  const confirmed = eruption.confirmed ? '' : '; not confirmed';
  return `${date}${plus}, ${vei}${dated}${confirmed}`;
}

/** A volcano's card: what the GVP says of it and of its eruptions near the year shown. */
export function volcanoCard(
  mark: VolcanoMark,
  details: VolcanoDetails | null,
): {
  readonly title: string;
  readonly facts: readonly (readonly [string, string])[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
  readonly image?: { readonly src: string; readonly alt: string; readonly credit: string };
  readonly note?: string;
} {
  const { volcano } = mark;
  const about = details?.volcanoes[String(volcano.number)];
  const photo = about?.photo ?? null;
  return {
    title: volcano.name,
    facts: [
      ...(volcano.kind === '' ? [] : [['Kind', volcano.kind] as const]),
      ...(volcano.country === '' ? [] : [['Country', volcano.country] as const]),
      ...(volcano.elevationM === null
        ? []
        : [['Elevation', `${volcano.elevationM.toLocaleString('en')} m`] as const]),
      [
        'Last known eruption',
        volcano.lastYear === null ? 'not known' : formatYear(astronomicalYear(volcano.lastYear)),
      ],
      ...mark.eruptions.map((eruption) => ['Eruption', eruptionText(eruption)] as const),
    ],
    links: [
      {
        label: 'Global Volcanism Program',
        href: `https://volcano.si.edu/volcano.cfm?vn=${String(volcano.number)}`,
      },
    ],
    ...(photo === null
      ? {}
      : {
          image: {
            src: photo.src,
            alt: `Photo of ${volcano.name}`,
            credit: `${photo.caption} ${photo.credit} Via the Global Volcanism Program.`,
          },
        }),
    ...(about === undefined || about.summary === ''
      ? details === null
        ? { note: 'Loading its summary…' }
        : {}
      : { note: about.summary }),
  };
}
