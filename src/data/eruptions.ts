/**
 * Eruptions of the Holocene as the ice cores record them (`public/data/eruptions.json`, #274):
 * HolVol v1.0 (Sigl et al. 2022), 9500 BCE to 1900 CE, written by the pipeline's `eruptions`
 * command. Each is the sulfur it put into the stratosphere, in Tg S, with its uncertainty; most
 * are known only from the ice, placed by region. Ice cores were lined up with tree rings by the
 * same cosmic-ray spikes the carbon-14 strip marks (774 and 993 CE; Sigl et al. 2015).
 */

import * as v from 'valibot';

import { valueAt } from '../util/arrays';
import { getJson, type Fetch } from '../util/fetchJson';

const REGIONS = ['iceland', 'located', 'north', 'south', 'tropics'] as const;
type EruptionRegion = (typeof REGIONS)[number];

const EruptionsSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
    credit: v.pipe(v.string(), v.minLength(1)),
    source: v.pipe(v.string(), v.url()),
    regions: v.array(v.picklist(REGIONS)),
    year: v.array(v.pipe(v.number(), v.integer())),
    latitude: v.array(v.pipe(v.number(), v.minValue(-90), v.maxValue(90))),
    region: v.array(v.pipe(v.number(), v.integer(), v.minValue(0))),
    sulfur: v.array(v.pipe(v.number(), v.minValue(0))),
    sigma: v.array(v.pipe(v.number(), v.minValue(0))),
  }),
  v.check(
    (data) =>
      [data.latitude, data.region, data.sulfur, data.sigma].every(
        (column) => column.length === data.year.length,
      ),
    'every column has a value for each eruption',
  ),
  v.check((data) => data.region.every((region) => region < data.regions.length), 'regions listed'),
  v.check(
    (data) => data.year.every((year, i) => i === 0 || valueAt(data.year, i - 1) <= year),
    'oldest first',
  ),
);

export type Eruptions = v.InferOutput<typeof EruptionsSchema>;

export async function loadEruptions(url: string, fetchJson: Fetch): Promise<Eruptions> {
  return getJson(fetchJson, url, EruptionsSchema);
}

/** Eruptions the sources name, by the ice cores' year and latitude. */
const NAMED_ERUPTIONS: readonly {
  readonly year: number;
  readonly latitude: number;
  readonly name: string;
  readonly note: string;
}[] = [
  {
    year: 1258,
    latitude: -8,
    name: 'Samalas',
    note: 'Samalas, Lombok, Indonesia: one of the largest eruptions of the last 2,000 years. Its own deposits date it to 1257 (Lavigne et al. 2013); the ice cores’ sulfur falls in 1258.',
  },
  {
    year: 1815,
    latitude: -8,
    name: 'Tambora',
    note: 'Tambora, Sumbawa, Indonesia, April 1815: the next year was the “year without a summer” in Europe and North America.',
  },
];

/** The largest sulfur injection in the record, Tg S: the strip's ticks are sized against it. */
export const LARGEST_SULFUR = 190;

export interface Eruption {
  readonly year: number;
  readonly latitude: number;
  readonly region: EruptionRegion;
  readonly sulfur: number;
  readonly sigma: number;
  /** The source's name for it, where one is given. */
  readonly name: string | null;
  readonly note: string | null;
}

/** The eruptions from astronomical year `first` to `last`, oldest first. */
export function eruptionsBetween(
  data: Eruptions,
  first: number,
  last: number,
): readonly Eruption[] {
  const found: Eruption[] = [];
  data.year.forEach((year, i) => {
    if (year < first || year > last) return;
    const latitude = valueAt(data.latitude, i);
    const named = NAMED_ERUPTIONS.find(
      (eruption) => eruption.year === year && eruption.latitude === latitude,
    );
    found.push({
      year,
      latitude,
      region: data.regions[valueAt(data.region, i)] ?? 'located',
      sulfur: valueAt(data.sulfur, i),
      sigma: valueAt(data.sigma, i),
      name: named?.name ?? null,
      note: named?.note ?? null,
    });
  });
  return found;
}

const WHERE: Readonly<Record<EruptionRegion, string>> = {
  tropics: 'a volcano in the tropics, its sulfur reaching both poles',
  north: 'a volcano in the northern mid to high latitudes',
  south: 'a volcano in the southern mid to high latitudes',
  iceland: 'a long eruption in Iceland',
  located: 'a volcano the authors identified',
};

/** A year as a reader says it, astronomical year 0 being 1 BCE. */
function yearWords(year: number): string {
  return year <= 0 ? `${String(1 - year)} BCE` : `${String(year)} CE`;
}

/** What an eruption's tick says. */
export function eruptionText(eruption: Eruption): string {
  const where =
    eruption.region === 'located'
      ? `${WHERE.located}, near ${String(Math.abs(eruption.latitude))}° ${eruption.latitude < 0 ? 'S' : 'N'}`
      : WHERE[eruption.region];
  const size = `${eruption.sulfur.toFixed(1)} ± ${eruption.sigma.toFixed(1)} Tg of sulfur into the stratosphere`;
  const head = eruption.name ?? where;
  return `${yearWords(eruption.year)}: ${head}, ${size}.${eruption.note === null ? '' : ` ${eruption.note}`}`;
}
