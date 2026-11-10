/**
 * Archaeological radiocarbon dates as a map of where people left dated remains (#149): p3k14c
 * (Bird et al. 2022, CC0), calibrated by the pipeline's `p3k14c` command and counted by 1° cell
 * and 250 calendar years over the last 12,500 (`public/data/radiocarbon-dates/heat.json`). The
 * dates themselves, with their sites, are in 5° tiles, fetched for a place's card. Locations are
 * fuzzed by the database to protect sites. The counts show where dates have been measured, not
 * how many people lived.
 */

import * as v from 'valibot';

import type { GeoPoint } from '../core/geo';
import { valueAt } from '../util/arrays';
import { getJson, type Fetch } from './fetchJson';

const Integer = v.pipe(v.number(), v.integer());

const HeatSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
    credit: v.pipe(v.string(), v.minLength(1)),
    source: v.pipe(v.string(), v.url()),
    cellDegrees: v.pipe(v.number(), v.gtValue(0)),
    stepYears: v.pipe(Integer, v.minValue(1)),
    reachBP: v.pipe(Integer, v.minValue(1)),
    tileDegrees: v.pipe(v.number(), v.gtValue(0)),
    latitude: v.array(v.number()),
    longitude: v.array(v.number()),
    step: v.array(v.pipe(Integer, v.minValue(0))),
    count: v.array(v.pipe(Integer, v.minValue(1))),
  }),
  v.check(
    (heat) =>
      [heat.longitude, heat.step, heat.count].every(
        (column) => column.length === heat.latitude.length,
      ),
    'every column has a value for each cell',
  ),
);

export type DatesHeat = v.InferOutput<typeof HeatSchema>;

const TileSchema = v.strictObject({
  schemaVersion: v.literal(1),
  sites: v.array(v.tuple([v.string(), v.string()])),
  /** Each: its cell's south-west corner (latitude, longitude), radiocarbon age, its error,
   * median calendar age BP, site, lab code, material, period. */
  samples: v.array(
    v.tuple([
      Integer,
      Integer,
      v.number(),
      v.pipe(v.number(), v.gtValue(0)),
      Integer,
      v.pipe(Integer, v.minValue(0)),
      v.string(),
      v.string(),
      v.string(),
    ]),
  ),
});

export type DatesTile = v.InferOutput<typeof TileSchema>;

export async function loadDatesHeat(url: string, fetchJson: Fetch): Promise<DatesHeat> {
  return getJson(fetchJson, url, HeatSchema);
}

export async function loadDatesTile(url: string, fetchJson: Fetch): Promise<DatesTile> {
  return getJson(fetchJson, url, TileSchema);
}

/** The calendar step a year falls in: 250 years counted back from 1950; null beyond reach. */
export function stepOf(heat: DatesHeat, year: number): number | null {
  const bp = 1950 - year;
  if (bp >= heat.reachBP) return null;
  return Math.floor(Math.max(0, bp) / heat.stepYears);
}

/** A step's span as astronomical years, oldest first. */
export function stepSpan(
  heat: DatesHeat,
  step: number,
): { readonly from: number; readonly to: number } {
  return {
    from: 1950 - (step + 1) * heat.stepYears + 1,
    to: 1950 - step * heat.stepYears,
  };
}

export interface DateCell {
  /** South-west corner, degrees. */
  readonly latitude: number;
  readonly longitude: number;
  readonly count: number;
}

export interface DatesNear {
  readonly cells: readonly DateCell[];
  readonly total: number;
  /** The span counted, astronomical years; null beyond reach. */
  readonly from: number;
  readonly to: number;
}

/** The cells with dates in the step holding `year`; null beyond reach. */
export function datesNear(heat: DatesHeat, year: number): DatesNear | null {
  const step = stepOf(heat, year);
  if (step === null) return null;
  const cells: DateCell[] = [];
  heat.step.forEach((each, i) => {
    if (each !== step) return;
    cells.push({
      latitude: valueAt(heat.latitude, i),
      longitude: valueAt(heat.longitude, i),
      count: valueAt(heat.count, i),
    });
  });
  return {
    cells,
    total: cells.reduce((sum, cell) => sum + cell.count, 0),
    ...stepSpan(heat, step),
  };
}

/** How strongly a cell is shaded, 0 to 1, on a log scale against the busiest cell shown. */
export function heatLevel(count: number, busiest: number): number {
  return Math.log1p(count) / Math.log1p(Math.max(1, busiest));
}

/** The tile a place falls in, as the pipeline names its file: ``40_-10``. */
export function tileKeyOf(heat: DatesHeat, place: GeoPoint): string {
  const size = heat.tileDegrees;
  return `${String(Math.floor(place.latitude / size) * size)}_${String(Math.floor(place.longitude / size) * size)}`;
}

export interface DatedSample {
  /** Its cell's south-west corner. */
  readonly latitude: number;
  readonly longitude: number;
  readonly age: number;
  readonly error: number;
  readonly medianBP: number;
  readonly site: string;
  readonly country: string;
  readonly lab: string;
  readonly material: string;
  readonly period: string;
}

export interface DatesHere {
  readonly samples: readonly DatedSample[];
  /** The sites, with how many dates each, most first. */
  readonly sites: readonly (readonly [string, number])[];
}

/** The dates in the place's cell whose calendar age falls in the step holding `year`. */
export function datesHere(
  heat: DatesHeat,
  tile: DatesTile,
  place: GeoPoint,
  year: number,
): DatesHere {
  const step = stepOf(heat, year);
  const size = heat.cellDegrees;
  const cellLat = Math.floor(place.latitude / size);
  const cellLon = Math.floor(place.longitude / size);
  const samples = tile.samples
    .filter(
      ([latitude, longitude, , , median]) =>
        latitude === cellLat * size &&
        longitude === cellLon * size &&
        step !== null &&
        Math.floor(median / heat.stepYears) === step,
    )
    .map(([latitude, longitude, age, error, medianBP, site, lab, material, period]) => {
      const [name, country] = tile.sites[site] ?? ['', ''];
      return {
        latitude,
        longitude,
        age,
        error,
        medianBP,
        site: name,
        country,
        lab,
        material,
        period,
      };
    })
    .sort((a, b) => a.medianBP - b.medianBP);
  const counts = new Map<string, number>();
  for (const { site } of samples) counts.set(site, (counts.get(site) ?? 0) + 1);
  const sites = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { samples, sites };
}

/** A year as a reader says it. */
function yearWords(year: number): string {
  return year <= 0 ? `${String(1 - year)} BCE` : `${String(year)} CE`;
}

/** What the layer says of the step shown, and of the place picked, if any. */
export function datesNote(near: DatesNear | null, here: DatesHere | null): string {
  if (near === null) return 'Dates are counted back to 10,550 BCE (12,500 years before 1950).';
  const span = `${yearWords(near.from)}–${yearWords(near.to)}`;
  const where = 'where dates have been measured, not how many people lived';
  if (here === null) {
    return `${near.total.toLocaleString('en')} radiocarbon dates fall in ${span}: ${where}. Pick a place to see its sites.`;
  }
  if (here.samples.length === 0) return `No dates in this square for ${span}: ${where}.`;
  const sites = here.sites
    .slice(0, 3)
    .map(([name, count]) => `${name || 'unnamed site'} (${String(count)})`)
    .join(', ');
  const more = here.sites.length > 3 ? `, and ${String(here.sites.length - 3)} more` : '';
  return `${String(here.samples.length)} dates in this square for ${span}: ${sites}${more}.`;
}
