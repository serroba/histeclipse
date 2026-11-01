/**
 * OpenHistoricalMap's borders (`public/data/ohm/`), a second view of past states beside
 * Cliopatria: country-level borders as dated lines and country names at label points, one file
 * per century, written by the pipeline's `ohm-borders` command. CC0, © OpenHistoricalMap
 * contributors.
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from './fetchJson';

const year = v.pipe(v.number(), v.integer());

const IndexSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.minLength(1)),
  centuries: v.array(year),
});

const CenturySchema = v.strictObject({
  schemaVersion: v.literal(1),
  century: year,
  scale: v.pipe(v.number(), v.gtValue(0)),
  borders: v.array(
    v.strictObject({
      from: year,
      to: year,
      points: v.pipe(
        v.array(v.pipe(v.number(), v.integer())),
        v.check((points) => points.length >= 4 && points.length % 2 === 0, 'lon/lat pairs'),
      ),
    }),
  ),
  labels: v.array(
    v.strictObject({
      name: v.pipe(v.string(), v.minLength(1)),
      from: year,
      to: year,
      longitude: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
      latitude: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
    }),
  ),
});

export type OhmIndex = v.InferOutput<typeof IndexSchema>;
export type OhmCentury = v.InferOutput<typeof CenturySchema>;

/** One year's borders (lines of [lon, lat] in degrees) and names. */
export interface OhmYear {
  readonly borders: readonly (readonly (readonly [number, number])[])[];
  readonly labels: readonly { name: string; latitude: number; longitude: number }[];
}

export async function loadOhmIndex(url: string, fetchJson: Fetch): Promise<OhmIndex> {
  return getJson(fetchJson, url, IndexSchema);
}

export async function loadOhmCentury(url: string, fetchJson: Fetch): Promise<OhmCentury> {
  return getJson(fetchJson, url, CenturySchema);
}

/** The borders and names in use in `year` (astronomical). */
export function ohmIn(century: OhmCentury, year: number): OhmYear {
  const during = (item: { readonly from: number; readonly to: number }): boolean =>
    item.from <= year && year <= item.to;
  return {
    borders: century.borders.filter(during).map(({ points }) => {
      const line: [number, number][] = [];
      for (let index = 0; index + 1 < points.length; index += 2) {
        line.push([
          elementAt(points, index) / century.scale,
          elementAt(points, index + 1) / century.scale,
        ]);
      }
      return line;
    }),
    labels: century.labels
      .filter(during)
      .map(({ name, latitude, longitude }) => ({ name, latitude, longitude })),
  };
}
