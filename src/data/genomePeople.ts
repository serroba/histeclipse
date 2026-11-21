/**
 * Each ancient individual of the AADR as a person (#1059): `public/data/genomes/people/{n}.json`,
 * by the pipeline's `genomes` command, row for row with the genomes file, in files of
 * `peopleChunk` rows read only when a card opens. What a region's card lists of the people dated
 * there: genetic sex, Y and mitochondrial lines, relatives, and each person in turn.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';

const text = v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(200)));
const positive = v.nullable(v.pipe(v.number(), v.gtValue(0)));

/** Each: ID, place, element, date, how dated, sex, Y, mtDNA, data, coverage, SNPs, kin, ROH, archive, age. */
const PersonSchema = v.tuple([
  v.pipe(v.string(), v.minLength(1)),
  v.pipe(v.string(), v.minLength(1)),
  text,
  text,
  text,
  v.nullable(v.picklist(['female', 'male'])),
  text,
  text,
  text,
  positive,
  positive,
  text,
  positive,
  v.nullable(v.pipe(v.string(), v.regex(/^PRJ[DEN][ABX]\d+$/))),
  text,
]);

const PeopleSchema = v.strictObject({
  schemaVersion: v.literal(1),
  first: v.pipe(v.number(), v.integer(), v.minValue(0)),
  people: v.array(PersonSchema),
});

export type Person = v.InferOutput<typeof PersonSchema>;
type People = v.InferOutput<typeof PeopleSchema>;

export async function loadPeople(url: string, fetchJson: Fetch): Promise<People> {
  return getJson(fetchJson, url, PeopleSchema);
}

/** The person on a row of the genomes file, from the files loaded so far. */
export type PersonAt = (row: number) => Person | undefined;

/** Look people up by their row in the genomes file, from the files loaded. */
export function peopleAt(files: readonly People[]): PersonAt {
  return (row) => {
    for (const file of files) {
      const person = file.people[row - file.first];
      if (person !== undefined) return person;
    }
    return undefined;
  };
}

/** People listed by name on a card before saying how many more. */
const PEOPLE_LISTED = 12;
/** Lines (haplogroups) listed, most first. */
const LINES_LISTED = 6;

/** A haplogroup's main line, so close branches count together: "R1b1a1b1a1a" is "R1b". */
export function lineOf(haplogroup: string): string {
  return /^[A-Z]+\d*[a-z]?/.exec(haplogroup)?.[0] ?? haplogroup;
}

function counted(values: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const most = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const listed = most.slice(0, LINES_LISTED).map(([value, n]) => `${value} ×${String(n)}`);
  const rest = most.length - listed.length;
  return listed.join(', ') + (rest > 0 ? `, and ${String(rest)} more` : '');
}

const ARCHIVE = 'https://www.ebi.ac.uk/ena/browser/view/';

/** One person in a line: "male · Y C1a · mt U8c · molar · 32326–30080 calBCE (…) · Sunghir, Russia". */
export function personLine(person: Person): string {
  const [, place, element, date, datedBy, sex, y, mt, data, coverage, snps, kin, roh, , age] =
    person;
  const read =
    data === null
      ? null
      : [
          data,
          coverage === null ? null : `${String(coverage)}× coverage`,
          snps === null ? null : `${snps.toLocaleString('en')} SNPs`,
        ]
          .filter((part) => part !== null)
          .join(', ');
  return [
    sex,
    age,
    y === null ? null : `Y ${y}`,
    mt === null ? null : `mt ${mt}`,
    element,
    date === null ? null : datedBy === null ? date : `${date} (${datedBy})`,
    place,
    read,
    roh === null ? null : `${String(roh)} cM in long runs of homozygosity`,
    kin === null ? null : `relatives: ${kin}`,
  ]
    .filter((part) => part !== null)
    .join(' · ');
}

/** What a region's card adds about its people: tallies, then each person, then their archives. */
export function peopleFacts(people: readonly Person[]): {
  readonly facts: readonly (readonly [string, string])[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
} {
  const female = people.filter((person) => person[5] === 'female').length;
  const male = people.filter((person) => person[5] === 'male').length;
  const untold = people.length - female - male;
  const ys = people.flatMap((person) => (person[6] === null ? [] : [lineOf(person[6])]));
  const mts = people.flatMap((person) => (person[7] === null ? [] : [lineOf(person[7])]));
  const kin = people.filter((person) => person[11] !== null).length;
  const listed = people.slice(0, PEOPLE_LISTED);
  const archives = [
    ...new Set(people.flatMap((person) => (person[13] === null ? [] : [person[13]]))),
  ];
  const facts: (readonly [string, string])[] = [
    [
      'Genetic sex',
      [
        `${String(female)} female`,
        `${String(male)} male`,
        ...(untold > 0 ? [`${String(untold)} not told`] : []),
      ].join(', '),
    ],
  ];
  if (ys.length > 0) facts.push(['Y lines (fathers’ fathers)', counted(ys)]);
  if (mts.length > 0) facts.push(['mtDNA lines (mothers’ mothers)', counted(mts)]);
  if (kin > 0) facts.push(['With relatives found', `${String(kin)} of ${String(people.length)}`]);
  for (const person of listed) facts.push([person[0], personLine(person)]);
  if (people.length > listed.length) {
    facts.push(['More', `${String(people.length - listed.length)} more people, not listed`]);
  }
  return {
    facts,
    links: archives.slice(0, 4).map((accession) => ({
      label: `Reads: ${accession}`,
      href: `${ARCHIVE}${accession}`,
    })),
  };
}
