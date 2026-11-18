/**
 * The telescopes (#847, epic #852): about forty of the most significant, in space and on the
 * ground, curated by stated criteria (the largest of their kind in their time, a first in their
 * band, or landmark discoveries) and written in `public/data/telescopes.json`, in the order the
 * list shows them. Each fact is from its operator's own pages, or a museum's or university's for
 * the historical ones, named in `sources` and linked from its card; none from Wikipedia.
 *
 * A ground telescope stands at its site from first light to its closing; one under construction
 * is marked so. A space telescope flies from launch to its end, on its kind of orbit, and is
 * found in GCAT by its id where it is in the record.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';

const BANDS = [
  'radio',
  'microwave',
  'infrared',
  'optical',
  'ultraviolet',
  'x-ray',
  'gamma',
] as const;

const ORBITS = ['low Earth', 'high Earth', 'L2', 'around the Sun'] as const;

/** A date as precise as its source gives it: a year, a month, or a day. */
const PartialDate = v.pipe(v.string(), v.regex(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/));

const Link = v.strictObject({
  label: v.pipe(v.string(), v.minLength(1)),
  href: v.pipe(v.string(), v.startsWith('https://')),
});

const Common = {
  id: v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  name: v.pipe(v.string(), v.minLength(1)),
  operators: v.pipe(v.array(v.pipe(v.string(), v.minLength(1))), v.minLength(1)),
  bands: v.pipe(v.array(v.picklist(BANDS)), v.minLength(1)),
  /** Its aperture or dish, metres; null where no one size applies, the note then saying why. */
  size: v.strictObject({ metres: v.nullable(v.pipe(v.number(), v.gtValue(0))), note: v.string() }),
  /** First light, or launch. */
  from: PartialDate,
  /** Its end; or still working; or, not yet working, when it is expected. */
  until: v.union([
    PartialDate,
    v.literal('operating'),
    v.strictObject({ construction: v.nullable(PartialDate) }),
  ]),
  /** Why it is here, in a sentence: which of the criteria it meets. */
  why: v.pipe(v.string(), v.minLength(1)),
  results: v.array(v.pipe(v.string(), v.minLength(1))),
  /** The registry's keys for its sources (`sources/registry.ts`). */
  sources: v.pipe(v.array(v.string()), v.minLength(1)),
  links: v.pipe(v.array(Link), v.minLength(1)),
};

const Ground = v.strictObject({
  ...Common,
  kind: v.literal('ground'),
  site: v.strictObject({
    name: v.pipe(v.string(), v.minLength(1)),
    latitude: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
    longitude: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
  }),
});

const Space = v.strictObject({
  ...Common,
  kind: v.literal('space'),
  orbit: v.picklist(ORBITS),
  /** Its GCAT id, where the site's record of craft has it (`d…` beyond Earth, `s…` about it). */
  craft: v.nullable(v.pipe(v.string(), v.regex(/^[ds]\d{5}$/))),
});

/** Year of a partial date, for comparing them. */
export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

/** Its end as a year, or null while it works or is being built. */
/** When a telescope ends: a date, still working, or being built. */
type Until = string | { readonly construction: string | null };

export function endYear(telescope: { readonly until: Until }): number | null {
  return typeof telescope.until === 'string' && telescope.until !== 'operating'
    ? yearOf(telescope.until)
    : null;
}

const TelescopesSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    telescopes: v.pipe(v.array(v.union([Ground, Space])), v.minLength(1)),
  }),
  v.check(
    (file) => new Set(file.telescopes.map((t) => t.id)).size === file.telescopes.length,
    'telescope ids must be unique',
  ),
  v.check(
    (file) => file.telescopes.every((t) => (endYear(t) ?? Infinity) >= yearOf(t.from)),
    'a telescope must end after it began',
  ),
);

export type Telescopes = v.InferOutput<typeof TelescopesSchema>;
export type Telescope = Telescopes['telescopes'][number];

export async function loadTelescopes(url: string, fetchJson: Fetch): Promise<Telescopes> {
  return getJson(fetchJson, url, TelescopesSchema);
}

/** Whether it was working, or being built, in `year`; and which. */
export function stateIn(
  telescope: { readonly from: string; readonly until: Until },
  year: number,
): 'working' | 'building' | null {
  if (typeof telescope.until === 'object')
    return year >= yearOf(telescope.from) ? 'building' : null;
  const end = endYear(telescope);
  if (year < yearOf(telescope.from)) return null;
  return end === null || year <= end ? 'working' : null;
}
