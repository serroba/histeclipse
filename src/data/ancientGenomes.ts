/**
 * Dated ancient genomes (`public/data/genomes/aadr.json`), from the Allen Ancient DNA Resource
 * (Mallick et al. 2024; Reich lab; CC0), by the pipeline's `genomes` command: ancient
 * individuals that pass its assessment, each by 2° cell and date, with the lab's group label
 * and the paper that published it. A region, never a site; labels are the lab's, not peoples.
 */

import * as v from 'valibot';

import { astronomicalYear, toHistoricalYear } from '../time/year';
import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from './fetchJson';

const index = v.pipe(v.number(), v.integer(), v.minValue(0));

const GenomesSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  version: v.pipe(v.string(), v.minLength(1)),
  cellDegrees: v.pipe(v.number(), v.gtValue(0)),
  /** South-west corners of the cells, degrees. */
  cells: v.array(v.tuple([v.number(), v.number()])),
  groups: v.array(v.string()),
  papers: v.array(v.strictObject({ name: v.string(), doi: v.string() })),
  /** Each: cell, years before 1950, lab label, paper (indexes into the tables). */
  genomes: v.array(v.tuple([index, v.pipe(v.number(), v.gtValue(0)), index, index])),
});

export type AncientGenomes = v.InferOutput<typeof GenomesSchema>;

export async function loadAncientGenomes(url: string, fetchJson: Fetch): Promise<AncientGenomes> {
  return getJson(fetchJson, url, GenomesSchema);
}

/** Years either side of the year shown that count as "near then". */
export const GENOME_WINDOW = 250;

/** A region's genomes near the year shown. */
export interface GenomeCell {
  /** The cell's index in the file, to find its genomes again for its card. */
  readonly cell: number;
  readonly latitude: number;
  readonly longitude: number;
  readonly count: number;
  /** The lab labels most often given there, with their counts, most first (at most three). */
  readonly labels: readonly (readonly [string, number])[];
  readonly papers: number;
}

export interface GenomesNear {
  readonly cells: readonly GenomeCell[];
  readonly total: number;
  /** The span counted, astronomical years. */
  readonly from: number;
  readonly to: number;
}

/** The genomes dated within GENOME_WINDOW years of `year` (astronomical), by region. */
export function genomesNear(data: AncientGenomes, year: number): GenomesNear {
  const from = year - GENOME_WINDOW;
  const to = year + GENOME_WINDOW;
  // Years before 1950, the AADR's count, as a calendar year: 1950 − BP (no year zero aside).
  const byCell = new Map<
    number,
    { count: number; labels: Map<number, number>; papers: Set<number> }
  >();
  let total = 0;
  for (const [cell, bp, group, paper] of data.genomes) {
    const when = 1950 - bp;
    if (when < from || when > to) continue;
    total += 1;
    let entry = byCell.get(cell);
    if (entry === undefined) {
      entry = { count: 0, labels: new Map(), papers: new Set() };
      byCell.set(cell, entry);
    }
    entry.count += 1;
    entry.labels.set(group, (entry.labels.get(group) ?? 0) + 1);
    entry.papers.add(paper);
  }
  const half = data.cellDegrees / 2;
  const cells = [...byCell.entries()]
    .map(([cell, entry]): GenomeCell => {
      const [south, west] = elementAt(data.cells, cell);
      const labels = [...entry.labels.entries()]
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, 3)
        .map(([group, count]) => [elementAt(data.groups, group), count] as const);
      return {
        cell,
        latitude: south + half,
        longitude: west + half,
        count: entry.count,
        labels,
        papers: entry.papers.size,
      };
    })
    .sort((a, b) => b.count - a.count);
  return { cells, total, from, to };
}

/** A span of years as "2750–2250 BCE", "1000–1500 CE", or "250 BCE–250 CE". */
export function yearSpanText(from: number, to: number): string {
  const first = toHistoricalYear(astronomicalYear(from));
  const last = toHistoricalYear(astronomicalYear(to));
  return first.era === last.era
    ? `${String(first.year)}–${String(last.year)} ${last.era}`
    : `${String(first.year)} ${first.era}–${String(last.year)} ${last.era}`;
}

/** What the Layers panel says about the genomes counted. */
export function genomesNote(near: GenomesNear): string {
  const regions = near.cells.length;
  return `${near.total.toLocaleString('en')} genomes dated ${yearSpanText(near.from, near.to)}, in ${String(regions)} regions: where genomes have been sequenced, not how many people lived. Labels are the lab’s, not peoples.`;
}

/** How many to list on a card, of labels and of papers, before saying how many more. */
const LISTED = 8;

/**
 * A region's card: its genomes near the year shown, by lab label and by paper, each paper
 * linked where it has a DOI. A region, never a site; labels are the lab's, not peoples.
 */
export function genomeCellCard(
  data: AncientGenomes,
  cell: number,
  year: number,
): {
  readonly title: string;
  readonly facts: readonly (readonly [string, string])[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
  readonly note: string;
} | null {
  const from = year - GENOME_WINDOW;
  const to = year + GENOME_WINDOW;
  const labels = new Map<number, number>();
  const papers = new Map<number, number>();
  let count = 0;
  let oldest = Infinity;
  let youngest = -Infinity;
  for (const [at, bp, group, paper] of data.genomes) {
    const when = 1950 - bp;
    if (at !== cell || when < from || when > to) continue;
    count += 1;
    oldest = Math.min(oldest, when);
    youngest = Math.max(youngest, when);
    labels.set(group, (labels.get(group) ?? 0) + 1);
    papers.set(paper, (papers.get(paper) ?? 0) + 1);
  }
  if (count === 0) return null;
  const [south, west] = elementAt(data.cells, cell);
  const size = data.cellDegrees;
  const degrees = (value: number, positive: string, negative: string) =>
    `${String(Math.abs(value))}°${value < 0 ? negative : positive}`;
  const most = <T>(counts: Map<T, number>) => [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const listed = (entries: readonly string[], all: number) =>
    entries.join(', ') + (all > entries.length ? `, and ${String(all - entries.length)} more` : '');
  const sortedPapers = most(papers);
  return {
    title: `Ancient genomes, ${degrees(south, 'N', 'S')}–${degrees(south + size, 'N', 'S')}, ${degrees(west, 'E', 'W')}–${degrees(west + size, 'E', 'W')}`,
    facts: [
      ['Genomes', count.toLocaleString('en')],
      ['Dated', yearSpanText(oldest, youngest)],
      [
        'Lab labels',
        listed(
          most(labels)
            .slice(0, LISTED)
            .map(([group, n]) => `${elementAt(data.groups, group)} ×${String(n)}`),
          labels.size,
        ),
      ],
      [
        'Published in',
        listed(
          sortedPapers.slice(0, LISTED).map(([paper]) => elementAt(data.papers, paper).name),
          papers.size,
        ),
      ],
    ],
    links: [
      ...sortedPapers.slice(0, LISTED).flatMap(([paper]) => {
        const { name, doi } = elementAt(data.papers, paper);
        return doi.startsWith('https://') ? [{ label: name, href: doi }] : [];
      }),
      { label: 'Allen Ancient DNA Resource', href: data.source },
    ],
    note: `Within ${String(GENOME_WINDOW)} years of the year shown, in a ${String(size)}° square: where genomes have been sequenced, not how many people lived. Labels are the lab’s, not peoples.`,
  };
}
