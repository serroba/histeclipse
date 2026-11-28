/**
 * The header every data file opens with (#1318): the registry ids of its sources
 * (`src/sources/sources.json`), the credit in words, the licence as its maker states it (or "none
 * stated"), the day the source was fetched, and what this site did to it. The pipeline writes it
 * (`data-pipeline/src/histeclipse_pipeline/header.py`); a file's schema spreads `HEADER` into its
 * own fields, and `sources/dataHeaders.test.ts` checks the served files against it.
 */

import * as v from 'valibot';

const text = v.pipe(v.string(), v.minLength(1));

/** What its numbers are in: one text, or one for each column. */
export const UNITS = v.union([text, v.record(v.string(), text)]);

export const HEADER = {
  sources: v.pipe(v.array(text), v.minLength(1)),
  credit: text,
  licence: text,
  accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  changes: text,
} as const;

/**
 * What the header adds to a file that already stated its credit, for its schema to allow, spread
 * before the schema's own fields so that one it declares itself stands. The served files are
 * held to them by `sources/dataHeaders.test.ts`; the site reads none of them.
 */
export const HEADER_ADDED = {
  sources: v.optional(HEADER.sources),
  licence: v.optional(HEADER.licence),
  accessed: v.optional(HEADER.accessed),
  changes: v.optional(HEADER.changes),
} as const;

/** The header alone, whatever else a file holds: what every served file is checked against. */
export const HeaderSchema = v.looseObject({
  schemaVersion: v.pipe(v.number(), v.integer(), v.minValue(1)),
  ...HEADER,
});
