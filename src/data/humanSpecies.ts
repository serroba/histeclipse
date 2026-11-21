/**
 * The Homo species the finds are of (`public/data/humans/species.json`, #1034): for each, what it
 * was, when and where it lived, its body, tools and DNA, each fact with the paper it rests on, and
 * what is argued over, every side attributed. Hand-curated, like the finds.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';
import { HUMAN_SPECIES, type HumanSpecies } from './humanClaims';
import { pictureFor, type Pictures } from './pictures';

const words = (most: number) => v.pipe(v.string(), v.minLength(1), v.maxLength(most));
const ka = v.pipe(v.number(), v.minValue(0));

const Fact = v.strictObject({
  text: words(260),
  source: v.strictObject({
    citation: words(120),
    doi: v.pipe(v.string(), v.regex(/^10\.\d{4,9}\/\S+$/)),
  }),
});
type Fact = v.InferOutput<typeof Fact>;

const SpeciesSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    species: v.array(
      v.pipe(
        v.strictObject({
          id: v.picklist(HUMAN_SPECIES),
          name: words(60),
          /** Its name in plain English, such as "Neanderthals", if it has one. */
          called: v.nullable(words(60)),
          /** Other scientific names it goes by. */
          aka: v.array(words(60)),
          summary: words(500),
          /** The span its accepted finds cover, thousands of years ago: oldest, then youngest. */
          firstKa: ka,
          lastKa: ka,
          facts: v.strictObject({
            span: v.array(Fact),
            body: v.array(Fact),
            tools: v.array(Fact),
            range: v.array(Fact),
            dna: v.array(Fact),
          }),
          /** What is argued over, each view with its source. */
          debates: v.array(
            v.strictObject({ question: words(160), views: v.pipe(v.array(Fact), v.minLength(2)) }),
          ),
          /** The fossil it was named from, and its finding. */
          typeFossil: v.nullable(words(160)),
          /** The English Wikipedia page about it, for its card's picture and link. */
          wikipedia: words(80),
        }),
        v.check((species) => species.firstKa >= species.lastKa, 'a span runs oldest to youngest'),
      ),
    ),
  }),
  v.check(
    (data) => new Set(data.species.map((species) => species.id)).size === data.species.length,
    'each species once',
  ),
);

export type HumanSpeciesData = v.InferOutput<typeof SpeciesSchema>;
type Species = HumanSpeciesData['species'][number];

export async function loadHumanSpecies(url: string, fetchJson: Fetch): Promise<HumanSpeciesData> {
  return getJson(fetchJson, url, SpeciesSchema);
}

/** A span in years, as "2.1 million to 110,000 years ago", or "since 315,000 years ago". */
export function spanWords(firstKa: number, lastKa: number): string {
  const years = (thousands: number) =>
    thousands >= 1000
      ? `${(thousands / 1000).toLocaleString('en', { maximumFractionDigits: 2 })} million`
      : (thousands * 1000).toLocaleString('en', { maximumFractionDigits: 0 });
  return lastKa === 0
    ? `${years(firstKa)} years ago to today`
    : `${years(firstKa)} to ${years(lastKa)} years ago`;
}

/** Facts as one line, each with whose it is. */
const said = (facts: readonly Fact[]): string =>
  facts.map((fact) => `${fact.text} (${fact.source.citation})`).join(' ');

/** A species' card: what it was, its span, body, tools, range and DNA, and what is argued. */
export function speciesCard(
  data: HumanSpeciesData,
  id: HumanSpecies,
  pictures: Pictures | null,
): {
  readonly title: string;
  readonly facts: readonly (readonly [string, string])[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
  readonly image?: { readonly src: string; readonly alt: string; readonly credit: string };
  readonly note: string;
} | null {
  const species = data.species.find((each) => each.id === id);
  if (species === undefined) return null;
  const rows = (label: string, facts: readonly Fact[]) =>
    facts.length === 0 ? [] : [[label, said(facts)] as const];
  const { image, links } = pictureFor(pictures, species.wikipedia, species.name);
  return {
    title: species.called === null ? species.name : `${species.called} (${species.name})`,
    facts: [
      ['What', species.summary],
      ...(species.aka.length === 0 ? [] : [['Also named', species.aka.join(', ')] as const]),
      ['When', spanWords(species.firstKa, species.lastKa)],
      ...rows('Dates', species.facts.span),
      ...rows('Body', species.facts.body),
      ...rows('Tools and ways', species.facts.tools),
      ...rows('Where', species.facts.range),
      ...rows('DNA', species.facts.dna),
      ...(species.typeFossil === null ? [] : [['Named from', species.typeFossil] as const]),
      ...species.debates.map(
        ({ question, views }) => ['Argued over', `${question} ${said(views)}`] as const,
      ),
    ],
    links: [...sourcesOf(species), ...links],
    ...(image === undefined ? {} : { image }),
    note: 'Where sources disagree, each view is given with its paper. Hand-picked, not complete.',
  };
}

/** Every paper a species' card rests on, once each, as links. */
function sourcesOf(species: Species): { label: string; href: string }[] {
  const facts = [
    ...Object.values(species.facts).flat(),
    ...species.debates.flatMap((debate) => debate.views),
  ];
  const seen = new Set<string>();
  return facts.flatMap(({ source }) => {
    if (seen.has(source.doi)) return [];
    seen.add(source.doi);
    return [{ label: source.citation, href: `https://doi.org/${source.doi}` }];
  });
}
