/**
 * The AADR's ice-age people on the Humans layer (#1059): `public/data/humans/aadr-ice-age.json`,
 * by the pipeline's `genomes` command. Those older than the Holocene, less the archaic and
 * earliest modern humans the Humans list has from their papers; gathered by the place the AADR
 * gives, each place a DNA site from its oldest person's date on, with a card of who they were.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';
import { peopleFacts, PersonSchema, type Person } from './genomePeople';
import { kaRange, type HumanSite } from './humanClaims';

const IceAgeSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url(), v.startsWith('https://')),
  people: v.array(
    v.strictObject({
      bp: v.pipe(v.number(), v.gtValue(0)),
      latitude: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
      longitude: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
      group: v.pipe(v.string(), v.minLength(1)),
      paper: v.strictObject({ name: v.string(), doi: v.string() }),
      person: PersonSchema,
    }),
  ),
});

export type IceAgeGenomes = v.InferOutput<typeof IceAgeSchema>;
type Entry = IceAgeGenomes['people'][number];

export async function loadIceAgeGenomes(url: string, fetchJson: Fetch): Promise<IceAgeGenomes> {
  return getJson(fetchJson, url, IceAgeSchema);
}

/** A place where ice-age people's genomes were read, and those people, oldest first. */
export interface DnaPlace {
  /** Picked as `human:dna-<slug>`. */
  readonly id: string;
  readonly name: string;
  readonly place: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly entries: readonly Entry[];
}

/** A place's name as an id: "Dolní Věstonice, Czechia" is "dolni-vestonice-czechia". */
function slug(place: string): string {
  return place
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The people gathered by the place the AADR gives, each place at its first person's spot. */
export function dnaPlaces(data: IceAgeGenomes): readonly DnaPlace[] {
  const byPlace = new Map<string, Entry[]>();
  for (const entry of data.people) {
    const place = entry.person[1];
    byPlace.set(place, [...(byPlace.get(place) ?? []), entry]);
  }
  return [...byPlace.entries()].map(([place, entries]) => {
    const oldest = [...entries].sort((a, b) => b.bp - a.bp);
    const first = oldest[0] ?? entries[0];
    return {
      id: `dna-${slug(place)}`,
      name: place.split(', ')[0] ?? place,
      place,
      latitude: first?.latitude ?? 0,
      longitude: first?.longitude ?? 0,
      entries: oldest,
    };
  });
}

const kaOf = (bp: number) => bp / 1000;

/** A place's span, thousands of years ago, to the century: "33.2–34.6 ka". */
function spanOf(place: DnaPlace): string {
  const bps = place.entries.map((entry) => Math.round(entry.bp / 100) / 10);
  return kaRange(Math.max(...bps), Math.min(...bps));
}

/** The DNA sites to mark `ka` thousand years ago: each from its oldest person's date on. */
export function dnaSitesAt(places: readonly DnaPlace[], ka: number): readonly HumanSite[] {
  return places.flatMap((place) => {
    const oldest = place.entries[0];
    if (oldest === undefined || ka > kaOf(oldest.bp)) return [];
    return [
      {
        id: place.id,
        label: `${place.name} DNA ${spanOf(place)}`,
        species: 'sapiens',
        point: { latitude: place.latitude, longitude: place.longitude },
        disputed: false,
        dna: true,
      },
    ];
  });
}

/** How many to list, of lab labels and papers, before saying how many more. */
const LISTED = 6;

function listed(values: readonly string[]): string {
  const unique = [...new Set(values)];
  const shown = unique.slice(0, LISTED);
  const rest = unique.length - shown.length;
  return shown.join(', ') + (rest > 0 ? `, and ${String(rest)} more` : '');
}

/**
 * A DNA site's card: who the people were (sex, lines, each in turn), when, the lab's labels and
 * the papers, linked by DOI, with their reads and the AADR.
 */
export function dnaCard(
  data: IceAgeGenomes,
  places: readonly DnaPlace[],
  slugOrId: string,
): {
  readonly title: string;
  readonly facts: readonly (readonly [string, string])[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
  readonly note: string;
} | null {
  const place = places.find((each) => each.id === slugOrId || each.id === `dna-${slugOrId}`);
  if (place === undefined) return null;
  const people: readonly Person[] = place.entries.map((entry) => entry.person);
  const known = peopleFacts(people);
  const papers = place.entries.map((entry) => entry.paper);
  const count = people.length;
  return {
    title: `Ancient DNA: ${place.place}`,
    facts: [
      ['Genomes', `${String(count)} ${count === 1 ? 'person' : 'people'}`],
      ['Dated', spanOf(place)],
      ...known.facts,
      ['Lab labels', listed(place.entries.map((entry) => entry.group))],
      ['Published in', listed(papers.map((paper) => paper.name))],
    ],
    links: [
      ...papers
        .filter(
          (paper, index) =>
            paper.doi.startsWith('https://') &&
            papers.findIndex((each) => each.doi === paper.doi) === index,
        )
        .slice(0, LISTED)
        .map((paper) => ({ label: paper.name, href: paper.doi })),
      ...known.links,
      { label: 'Allen Ancient DNA Resource', href: data.source },
    ],
    note: 'From the Allen Ancient DNA Resource (CC0): genomes of our own species read from ice-age remains, at the place it gives, which can be a few kilometres out. Labels are the lab’s, not peoples; lines are the main branches of each haplogroup.',
  };
}
