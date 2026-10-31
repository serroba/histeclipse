/**
 * A curated list of well-known eclipses (`public/data/famous-eclipses.json`), each tied to a
 * historical source. The test suite checks every entry against the computed catalogs.
 */

import * as v from 'valibot';

import { defaultCalendarFor, type Selection } from '../state/viewState';
import { calendarDateOf, julianDay, type CalendarDate } from '../time/julianDay';
import { astronomicalYear } from '../time/year';
import { getJson, type Fetch } from './fetchJson';

const DATE = /^(-?\d{1,5})-(\d{2})-(\d{2})$/;

const FamousEclipseSchema = v.strictObject({
  /** Stable, URL-safe identifier. */
  id: v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/)),
  kind: v.picklist(['solar', 'lunar']),
  /** Day of greatest eclipse in UT, astronomical year, in the calendar in use at the time. */
  date: v.pipe(v.string(), v.regex(DATE)),
  title: v.pipe(v.string(), v.minLength(1)),
  summary: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.minLength(1)),
  /** Whether historians disagree about which eclipse the record describes. */
  debated: v.boolean(),
  debateNote: v.optional(v.pipe(v.string(), v.minLength(1))),
  /** A place connected with the record, when one is known. */
  place: v.optional(
    v.strictObject({
      name: v.pipe(v.string(), v.minLength(1)),
      latitude: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
      longitude: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
    }),
  ),
  /** What that place saw: a solar phase, or lunar visibility; "uncertain" when ΔT decides. */
  seen: v.optional(v.picklist(['total', 'annular', 'partial', 'visible', 'hidden', 'uncertain'])),
});

const FamousEclipsesSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    note: v.string(),
    eclipses: v.array(FamousEclipseSchema),
  }),
  v.check(
    (document) =>
      new Set(document.eclipses.map((eclipse) => eclipse.id)).size === document.eclipses.length,
    'eclipse ids must be unique',
  ),
  v.check(
    (document) =>
      document.eclipses.every((eclipse) => eclipse.debated === (eclipse.debateNote !== undefined)),
    'debated eclipses, and only those, need a debateNote',
  ),
  v.check(
    (document) =>
      document.eclipses.every(
        (eclipse) => (eclipse.place === undefined) === (eclipse.seen === undefined),
      ),
    'a place and what it saw go together',
  ),
);

export type FamousEclipse = v.InferOutput<typeof FamousEclipseSchema>;

export async function loadFamousEclipses(
  url: string,
  fetchJson: Fetch,
): Promise<readonly FamousEclipse[]> {
  return (await getJson(fetchJson, url, FamousEclipsesSchema)).eclipses;
}

/** The parts of an entry's date: [astronomical year, month, day]. */
export function famousDateParts(eclipse: FamousEclipse): [number, number, number] {
  const match = DATE.exec(eclipse.date);
  if (match === null) throw new RangeError(`Bad date ${eclipse.date}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** The famous entry for the eclipse a selection points at, if there is one. */
export function famousFor(
  famous: readonly FamousEclipse[],
  selection: Selection | null,
): FamousEclipse | undefined {
  if (selection === null) return undefined;
  const selected = Math.floor(julianDay(selection.date) + 0.5);
  return famous.find(
    (entry) =>
      entry.kind === selection.kind && Math.floor(julianDay(famousDate(entry)) + 0.5) === selected,
  );
}

/** An entry's date as a calendar date, in the calendar in use at the time. */
export function famousDate(entry: FamousEclipse): CalendarDate {
  const [year, month, day] = famousDateParts(entry);
  return calendarDateOf(astronomicalYear(year), month, day, defaultCalendarFor(year, month, day));
}
