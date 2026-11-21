/**
 * Dated finds of Homo sapiens and its relatives (`public/data/humans/claims.json`), each as its
 * source reports it, hand-curated: where finds are argued over, the competing claims share a
 * question and are shown side by side, so the reader can weigh them.
 */

import * as v from 'valibot';

import type { GeoPoint } from '../core/geo';
import { getJson, type Fetch } from '../util/fetchJson';
import { pictureFor, type Pictures } from './pictures';

const ka = v.pipe(v.number(), v.minValue(0));
const words = (most: number) => v.pipe(v.string(), v.minLength(1), v.maxLength(most));

/** The Homo species the finds are of, from the earliest Homo on. */
export const HUMAN_SPECIES = [
  'early-homo',
  'habilis',
  'rudolfensis',
  'erectus',
  'antecessor',
  'heidelbergensis',
  'naledi',
  'floresiensis',
  'luzonensis',
  'longi',
  'neanderthal',
  'denisovan',
  'sapiens',
] as const;
export type HumanSpecies = (typeof HUMAN_SPECIES)[number];

const Source = v.strictObject({
  citation: v.pipe(v.string(), v.minLength(1)),
  doi: v.pipe(v.string(), v.regex(/^10\.\d{4,9}\/\S+$/)),
});

const ClaimsSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(2),
    about: v.pipe(v.string(), v.minLength(1)),
    questions: v.array(
      v.strictObject({
        id: v.pipe(v.string(), v.regex(/^[a-z-]+$/)),
        title: v.pipe(v.string(), v.minLength(1)),
      }),
    ),
    claims: v.array(
      v.pipe(
        v.strictObject({
          id: v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/)),
          species: v.picklist(HUMAN_SPECIES),
          question: v.optional(v.pipe(v.string(), v.minLength(1))),
          place: v.nullable(
            v.strictObject({
              name: v.pipe(v.string(), v.minLength(1)),
              region: v.pipe(v.string(), v.minLength(1)),
              latitude: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
              longitude: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
            }),
          ),
          /** The date's range, thousands of years ago: oldest, then youngest. */
          /** Null for a find not directly dated (#1047): shown while its species is attested. */
          fromKa: v.nullable(ka),
          toKa: v.nullable(ka),
          claim: v.pipe(v.string(), v.minLength(1)),
          /** The paper that dates it. */
          source: Source,
          /** What was found: bones, teeth, tools, DNA. */
          found: words(200),
          /** How it was dated: the method, and on what. */
          dating: words(200),
          /** When it was found, and by whom, where known. */
          discovered: v.nullable(words(200)),
          /** Why it matters, with any dispute attributed. */
          matters: words(320),
          /** Other species it has been read as, and by whom (#1034). */
          alsoRead: v.optional(
            v.array(v.strictObject({ species: v.picklist(HUMAN_SPECIES), source: Source })),
          ),
          /** Other papers the card's words rest on, such as a dispute's other side. */
          extraSources: v.optional(v.array(Source)),
          /**
           * Other studies of it than the one that dates it (#177): each bears it out or challenges
           * it, by its kind of evidence, with what it found.
           */
          evidence: v.optional(
            v.array(
              v.strictObject({
                stance: v.picklist(['supports', 'challenges']),
                kind: v.picklist([
                  'dating',
                  'fossil',
                  'genetic',
                  'archaeological',
                  'environmental',
                ]),
                text: words(260),
                source: Source,
              }),
            ),
          ),
          /** The English Wikipedia page about the find, for its card's picture and link. */
          wikipedia: v.optional(v.pipe(v.string(), v.minLength(1))),
        }),
        v.check(
          (claim) =>
            (claim.fromKa === null) === (claim.toKa === null) &&
            (claim.fromKa === null || claim.toKa === null || claim.fromKa >= claim.toKa),
          'a date runs from oldest to youngest, or is not given at all',
        ),
      ),
    ),
  }),
  v.check(
    (data) =>
      data.claims.every(
        (claim) =>
          claim.question === undefined || data.questions.some((q) => q.id === claim.question),
      ),
    'every question a claim names is listed',
  ),
);

export type HumanClaims = v.InferOutput<typeof ClaimsSchema>;
type Claim = HumanClaims['claims'][number];

export async function loadHumanClaims(url: string, fetchJson: Fetch): Promise<HumanClaims> {
  return getJson(fetchJson, url, ClaimsSchema);
}

/** A find marked on the globe. */
export interface HumanSite {
  readonly id: string;
  readonly label: string;
  readonly species: Claim['species'];
  readonly point: GeoPoint;
  /** Whether other claims compete with it. */
  readonly disputed: boolean;
}

/** A claim as the note gives it: what, when, and whose. */
export interface ClaimLine {
  readonly text: string;
  readonly citation: string;
  readonly doi: string;
  /** Whether the moment shown is at or after its date. */
  readonly reached: boolean;
}

export interface HumansView {
  readonly sites: readonly HumanSite[];
  /** Questions with a claim reached, each with all its competing claims. */
  readonly questions: readonly { readonly title: string; readonly claims: readonly ClaimLine[] }[];
  /** Claims reached that have no place to mark and no rival. */
  readonly others: readonly ClaimLine[];
}

/**
 * One formatter for every date (#1045): `toLocaleString` makes a new one each call, and the
 * finds' dates are written for every find on every frame while time plays.
 */
const TWO_PLACES = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });

/** A date range in thousands of years, as "59–71 ka" or "233 ka". */
export function kaRange(fromKa: number, toKa: number): string {
  // A million years and more read in millions: "1.8–1.85 Ma", not "1,800–1,850 ka".
  const [unit, scale] = fromKa >= 1000 ? (['Ma', 1000] as const) : (['ka', 1] as const);
  const each = (value: number) => TWO_PLACES.format(value / scale);
  return fromKa === toKa ? `${each(fromKa)} ${unit}` : `${each(toKa)}–${each(fromKa)} ${unit}`;
}

/**
 * The span each species' dated finds cover, thousands of years ago: from the oldest date any
 * claim gives it to the youngest, so long-gone species leave the map. Our own species is still
 * here.
 */
function attested(data: HumanClaims): ReadonlyMap<HumanSpecies, { first: number; last: number }> {
  const spans = new Map<HumanSpecies, { first: number; last: number }>();
  for (const claim of data.claims) {
    if (claim.fromKa === null || claim.toKa === null) continue;
    const known = spans.get(claim.species);
    spans.set(claim.species, {
      first: Math.max(known?.first ?? -Infinity, claim.fromKa),
      last: claim.species === 'sapiens' ? 0 : Math.min(known?.last ?? Infinity, claim.toKa),
    });
  }
  return spans;
}

/** When a find shows from: its oldest date, or for an undated one its species' oldest. */
function startOf(
  claim: Claim,
  spans: ReadonlyMap<HumanSpecies, { first: number; last: number }>,
): number {
  return claim.fromKa ?? spans.get(claim.species)?.first ?? 0;
}

/** A find's date in words: its range, or that it is not directly dated. */
function dateOf(claim: Claim): string {
  return claim.fromKa === null || claim.toKa === null
    ? 'undated'
    : kaRange(claim.fromKa, claim.toKa);
}

/**
 * What to show `shownKa` thousand years ago: each find from its oldest date on, while its species
 * is still attested (to the youngest date any claim gives it), so long-gone species leave the map;
 * an undated find (#1047) for as long as its species is attested.
 */
export function humansAt(data: HumanClaims, shownKa: number): HumansView {
  const spans = attested(data);
  const reached = (claim: Claim) => shownKa <= startOf(claim, spans);
  const living = (claim: Claim) => shownKa >= (spans.get(claim.species)?.last ?? 0);
  const line = (claim: Claim): ClaimLine => ({
    text: `${dateOf(claim)}: ${claim.claim}`,
    citation: claim.source.citation,
    doi: claim.source.doi,
    reached: reached(claim),
  });
  // The newest first: where names crowd, those placed first are kept, and the latest finds are
  // what the moment shown is about.
  const newestFirst = [...data.claims].sort((a, b) => startOf(a, spans) - startOf(b, spans));
  const sites = newestFirst.flatMap((claim): HumanSite[] =>
    claim.place === null || !reached(claim) || !living(claim)
      ? []
      : [
          {
            id: claim.id,
            label: `${claim.place.name} ${dateOf(claim)}`,
            species: claim.species,
            point: { latitude: claim.place.latitude, longitude: claim.place.longitude },
            disputed: claim.question !== undefined,
          },
        ],
  );
  const questions = data.questions.flatMap((question) => {
    const claims = data.claims.filter((claim) => claim.question === question.id);
    return claims.some(reached) ? [{ title: question.title, claims: claims.map(line) }] : [];
  });
  const others = data.claims
    .filter((claim) => claim.place === null && claim.question === undefined && reached(claim))
    .map(line);
  return { sites, questions, others };
}

/** Each species by the name a reader knows it by. */
export const SPECIES_NAMES: Readonly<Record<HumanSpecies, string>> = {
  'early-homo': 'Early Homo',
  habilis: 'Homo habilis',
  rudolfensis: 'Homo rudolfensis',
  erectus: 'Homo erectus',
  antecessor: 'Homo antecessor',
  heidelbergensis: 'Homo heidelbergensis',
  naledi: 'Homo naledi',
  floresiensis: 'Homo floresiensis',
  luzonensis: 'Homo luzonensis',
  longi: 'Homo longi',
  neanderthal: 'Neanderthals',
  denisovan: 'Denisovans',
  sapiens: 'Homo sapiens',
};

/** Who it was, and who else it has been read as. */
function who(claim: Claim): string {
  const others = (claim.alsoRead ?? []).map(
    (reading) => `${SPECIES_NAMES[reading.species]} (${reading.source.citation})`,
  );
  const name = SPECIES_NAMES[claim.species];
  return others.length === 0 ? name : `${name}; also read as ${others.join('; ')}`;
}

/** How many other studies bear a find out, and how many challenge it, or that none is known. */
function weighed(claim: Claim): string {
  const items = claim.evidence ?? [];
  if (items.length === 0)
    return 'None found yet beyond the paper that dates it: one study’s reading, to weigh as such.';
  const count = (stance: string) => items.filter((item) => item.stance === stance).length;
  const studies = (n: number) => `${String(n)} ${n === 1 ? 'study' : 'studies'}`;
  const [support, challenge] = [count('supports'), count('challenges')];
  return (
    [
      ...(support > 0 ? [`${studies(support)} ${support === 1 ? 'supports' : 'support'} it`] : []),
      ...(challenge > 0
        ? [`${studies(challenge)} ${challenge === 1 ? 'challenges' : 'challenge'} it`]
        : []),
    ].join('; ') + '.'
  );
}

/** A paper as a link to its DOI. */
const doiLink = (source: { citation: string; doi: string }) => ({
  label: source.citation,
  href: `https://doi.org/${source.doi}`,
});

export function claimCard(
  data: HumanClaims,
  id: string,
  pictures: Pictures | null,
): {
  readonly title: string;
  readonly facts: readonly (readonly [string, string])[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
  readonly image?: { readonly src: string; readonly alt: string; readonly credit: string };
  readonly note?: string;
} | null {
  const claim = data.claims.find((each) => each.id === id);
  if (claim === undefined) return null;
  const name = claim.place?.name ?? claim.claim;
  const question = data.questions.find((each) => each.id === claim.question);
  const rivals = data.claims.filter(
    (each) => each.question !== undefined && each.question === claim.question && each !== claim,
  );
  const { image, links } = pictureFor(pictures, claim.wikipedia, name);
  return {
    title: name,
    facts: [
      ['Who', who(claim)],
      ...(claim.place === null ? [] : [['Where', claim.place.region] as const]),
      [
        'When',
        claim.fromKa === null || claim.toKa === null
          ? 'Not directly dated: shown while its species is attested'
          : `${kaRange(claim.fromKa, claim.toKa)} (thousands of years ago)`,
      ],
      ['Claim', claim.claim],
      ['Found', claim.found],
      ['Dated by', claim.dating],
      ...(claim.discovered === null ? [] : [['Discovered', claim.discovered] as const]),
      ['Why it matters', claim.matters],
      ['Source', claim.source.citation],
      ['Other studies', weighed(claim)],
      ...(claim.evidence ?? []).map(
        (item) =>
          [
            `${item.stance === 'supports' ? 'Supports' : 'Challenges'} (${item.kind})`,
            `${item.text} (${item.source.citation})`,
          ] as const,
      ),
    ],
    links: [
      doiLink(claim.source),
      ...[
        ...(claim.alsoRead ?? []).map((reading) => reading.source),
        ...(claim.extraSources ?? []),
        ...(claim.evidence ?? []).map((item) => item.source),
      ]
        .filter((source, index, all) => all.findIndex((each) => each.doi === source.doi) === index)
        .filter((source) => source.doi !== claim.source.doi)
        .map(doiLink),
      ...links,
    ],
    ...(image === undefined ? {} : { image }),
    ...(question === undefined
      ? {}
      : {
          note: `One answer to “${question.title}” Others: ${rivals
            .map((rival) => `${dateOf(rival)}, ${rival.source.citation}`)
            .join('; ')}.`,
        }),
  };
}
