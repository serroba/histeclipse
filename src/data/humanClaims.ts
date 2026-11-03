/**
 * Dated finds of Homo sapiens and its relatives (`public/data/humans/claims.json`), each as its
 * source reports it, hand-curated: where finds are argued over, the competing claims share a
 * question and are shown side by side, so the reader can weigh them.
 */

import * as v from 'valibot';

import type { GeoPoint } from '../state/viewState';
import { getJson, type Fetch } from './fetchJson';

const ka = v.pipe(v.number(), v.minValue(0));

const ClaimsSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
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
          species: v.picklist(['sapiens', 'neanderthal', 'denisovan']),
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
          fromKa: ka,
          toKa: ka,
          claim: v.pipe(v.string(), v.minLength(1)),
          source: v.strictObject({
            citation: v.pipe(v.string(), v.minLength(1)),
            doi: v.pipe(v.string(), v.regex(/^10\.\d{4,9}\/\S+$/)),
          }),
        }),
        v.check((claim) => claim.fromKa >= claim.toKa, 'a date runs from oldest to youngest'),
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

/** A date range in thousands of years, as "59–71 ka" or "233 ka". */
export function kaRange(fromKa: number, toKa: number): string {
  const each = (value: number) => value.toLocaleString('en', { maximumFractionDigits: 2 });
  return fromKa === toKa ? `${each(fromKa)} ka` : `${each(toKa)}–${each(fromKa)} ka`;
}

/** What to show `shownKa` thousand years ago: each find from its oldest date onwards. */
export function humansAt(data: HumanClaims, shownKa: number): HumansView {
  const reached = (claim: Claim) => shownKa <= claim.fromKa;
  const line = (claim: Claim): ClaimLine => ({
    text: `${kaRange(claim.fromKa, claim.toKa)}: ${claim.claim}`,
    citation: claim.source.citation,
    doi: claim.source.doi,
    reached: reached(claim),
  });
  const sites = data.claims.flatMap((claim): HumanSite[] =>
    claim.place === null || !reached(claim)
      ? []
      : [
          {
            id: claim.id,
            label: `${claim.place.name} ${kaRange(claim.fromKa, claim.toKa)}`,
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
