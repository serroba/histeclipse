/**
 * Named archaeological and historical periods by country (`public/data/periods.json`), from
 * PeriodO (CC0) by the pipeline's `periods` command, with Natural Earth's country outlines:
 * each period's name, years, the countries it covers and the source that defines it, since
 * sources date the same name differently.
 */

import * as v from 'valibot';

import type { GeoPoint } from '../core/geo';
import { elementAt } from '../util/arrays';
import { insideWrapped, ringsOf, type Ring } from '../util/polygons';
import { getJson, type Fetch } from './fetchJson';

const integer = v.pipe(v.number(), v.integer());

const PeriodsSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  countries: v.array(v.strictObject({ name: v.string(), rings: v.array(v.array(integer)) })),
  citations: v.array(v.string()),
  /** Each: name, first and last year (astronomical), citation, countries (indexes). */
  periods: v.array(v.tuple([v.string(), integer, integer, integer, v.array(integer)])),
});

export type NamedPeriods = v.InferOutput<typeof PeriodsSchema>;

export async function loadNamedPeriods(url: string, fetchJson: Fetch): Promise<NamedPeriods> {
  return getJson(fetchJson, url, PeriodsSchema);
}

/** The countries' outlines in degrees, worked out once. */
export function countryRings(data: NamedPeriods): readonly (readonly Ring[])[] {
  return data.countries.map((country) => ringsOf(country.rings, 100));
}

export interface PeriodsHere {
  readonly country: string;
  /** Each period covering the place's country in the year, with whose definition it is. */
  readonly periods: readonly {
    readonly name: string;
    readonly from: number;
    readonly to: number;
    readonly citation: string;
  }[];
}

/** The periods covering the country of `place` in `year`; null where no country is there. */
export function periodsHere(
  data: NamedPeriods,
  rings: readonly (readonly Ring[])[],
  place: GeoPoint,
  year: number,
): PeriodsHere | null {
  const country = rings.findIndex((each) => insideWrapped(each, place.longitude, place.latitude));
  if (country < 0) return null;
  const periods = data.periods
    .filter(
      ([, from, to, , countries]) => from <= year && year <= to && countries.includes(country),
    )
    .map(([name, from, to, cited]) => ({
      name,
      from,
      to,
      citation: elementAt(data.citations, cited),
    }))
    // The narrowest first: the most specific periods say most about the year.
    .sort((a, b) => a.to - a.from - (b.to - b.from));
  return { country: elementAt(data.countries, country).name, periods };
}

/** How many periods the note names before "and N more". */
const NAMED = 5;

/** What the Layers panel says of the periods at the place picked. */
export function periodsText(here: PeriodsHere | null, year: string): string {
  if (here === null) return 'Pick a place on land to see the periods named there.';
  if (here.periods.length === 0)
    return `No named periods for ${here.country} in ${year} in PeriodO.`;
  const named = here.periods
    .slice(0, NAMED)
    .map((period) => `${period.name} (${period.citation})`)
    .join('; ');
  const more = here.periods.length - NAMED;
  return `Periods named for ${here.country} in ${year}, each by its source: ${named}${more > 0 ? `; and ${String(more)} more` : ''}.`;
}
