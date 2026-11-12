/**
 * Where everything on screen comes from: each source once (who made it, where to find it, under
 * what licence), and for each thing the reader can see, a "why": what it shows, which sources it
 * rests on, and how this site used them. The "Why this?" marks and the Sources panel read these.
 *
 * The data is in sources.json and whys.json; the checks that every layer has its why, and that
 * every entry has the right shape, are in registry.test.ts.
 */

import sourcesJson from './sources.json' with { type: 'json' };
import whysJson from './whys.json' with { type: 'json' };

/** What kind of thing a source is, each shown with its own icon. */
export type SourceKind = 'paper' | 'dataset' | 'model' | 'imagery' | 'catalogue' | 'reference';

export interface Source {
  /** The name a link reads as. */
  readonly name: string;
  readonly kind: SourceKind;
  /** The full reference: authors, year, venue, version. */
  readonly cite: string;
  readonly url: string;
  /** As its maker states it; omitted when none is stated. */
  readonly licence?: string;
  /** Non-commercial terms: shown with a warning, since they bind what the site may do. */
  readonly nonCommercial?: true;
}

// The sources themselves are content, kept in sources.json (#383); registry.test.ts checks each
// one's shape.
export const SOURCES = sourcesJson as Readonly<Record<keyof typeof sourcesJson, Source>>;

export type SourceId = keyof typeof SOURCES;

/** What a thing on screen shows, what it rests on, and how this site made it. */
export interface Why {
  readonly title: string;
  readonly what: string;
  readonly sources: readonly SourceId[];
  /** What this site did with them: simplified, packed, interpolated… */
  readonly how?: string;
  /** Where sources disagree, and how to see the others. */
  readonly others?: string;
  /** The kinds of evidence a reconstruction rests on: what each tells, and a key paper. */
  readonly evidence?: readonly {
    readonly name: string;
    readonly says: string;
    readonly source: SourceId;
  }[];
  /** How sure each part is, from firmest to most illustrative. */
  readonly certainty?: readonly string[];
  /** Where a student might read on, in order. */
  readonly reading?: readonly SourceId[];
}

// The whys are content, kept in whys.json (#383); registry.test.ts checks each one's shape and
// that every source it names exists.
export const WHYS = whysJson as Readonly<Record<keyof typeof whysJson, Why>>;

export type WhyId = keyof typeof WHYS;

/**
 * What the why panel can show: one thing's why, every source ('all'), or what each layer has
 * at the place picked ('here').
 */
export type WhyView = WhyId | 'all' | 'here';
export const WHY_VIEWS: readonly WhyView[] = [...(Object.keys(WHYS) as WhyId[]), 'all', 'here'];

/** What one layer has at the place picked, for "Why here?", and the why of its source. */
export interface HereFact {
  /** What layer the fact is from. */
  readonly title: string;
  readonly text: string;
  /** The why of where it comes from. */
  readonly why: WhyId;
  readonly link?: { readonly label: string; readonly href: string };
}

/** A source's DOI, when its link is one. */
export function doiOf(source: Source): string | null {
  const match = /^https:\/\/doi\.org\/(.+)$/.exec(source.url);
  return match?.[1] ?? null;
}

/** The reference to copy: the full citation, where to find it, and its licence. */
export function citation(source: Source): string {
  const licence = source.licence === undefined ? '' : ` Licence: ${source.licence}.`;
  return `${source.cite}. ${source.url}${licence}`;
}

/** Where to get a source's BibTeX, from Crossref, when it has a DOI. */
export function bibtexUrl(source: Source): string | null {
  const doi = doiOf(source);
  return doi === null
    ? null
    : `https://api.crossref.org/works/${doi}/transform/application/x-bibtex`;
}
