/**
 * Eclipse catalogs the data pipeline writes to `public/data/<kind>/`: an `index.json` plus one
 * file per century. Runtime schemas mirror `data-pipeline/src/histeclipse_pipeline/catalog.py`;
 * every file is validated when loaded, so a pipeline/app mismatch fails loudly instead of
 * rendering wrong data.
 */

import * as v from 'valibot';

import {
  calendarDate,
  historicalCalendar,
  julianDayNumber,
  type JulianDay,
} from '../time/julianDay';
import { formatYear, type AstronomicalYear } from '../time/year';
import { CatalogError, getJson, type Fetch } from './fetchJson';

export { CatalogError, type Fetch } from './fetchJson';

export const finite = v.pipe(v.number(), v.finite());
export const integer = v.pipe(v.number(), v.integer());
/** A Julian Day in TT, as stored in the catalogs. */
export const julianDayTT = v.pipe(finite, v.minValue(0), v.transform(julianDayNumber));
/** [latitude, longitude] in degrees. */
export const geoPoint = v.tuple([
  v.pipe(finite, v.minValue(-90), v.maxValue(90)),
  v.pipe(finite, v.minValue(-180), v.maxValue(180)),
]);

const IndexSchema = v.strictObject({
  schemaVersion: v.literal(1),
  kind: v.picklist(['lunar', 'solar']),
  ephemeris: v.string(),
  deltaTModel: v.string(),
  startYear: integer,
  endYear: integer,
  yearsPerChunk: v.pipe(integer, v.minValue(1)),
  chunks: v.array(
    v.strictObject({
      startYear: integer,
      file: v.pipe(v.string(), v.regex(/^-?\d+\.json$/)),
      count: v.pipe(integer, v.minValue(0)),
    }),
  ),
});

export type CatalogIndex = v.InferOutput<typeof IndexSchema>;
export type CatalogKind = CatalogIndex['kind'];

/** What every catalog record has: greatest eclipse in TT and the ΔT it was computed with. */
export interface CatalogRecord {
  readonly jdTT: JulianDay;
  readonly deltaT: number;
}

/** The astronomical year of a Julian Day, in the calendar in use at the time. */
export function yearOf(jd: JulianDay): AstronomicalYear {
  return calendarDate(jd, historicalCalendar(jd)).year;
}

/** Greatest eclipse in Universal Time, using the ΔT the catalog computed it with. */
export function greatestEclipseUT(eclipse: CatalogRecord): JulianDay {
  return julianDayNumber(eclipse.jdTT - eclipse.deltaT / 86_400);
}

export class EclipseCatalog<Record extends CatalogRecord> {
  readonly index: CatalogIndex;
  readonly #baseUrl: string;
  readonly #readChunk: (url: string) => Promise<readonly Record[]>;
  readonly #chunks = new Map<number, Promise<readonly Record[]>>();

  private constructor(
    index: CatalogIndex,
    baseUrl: string,
    readChunk: (url: string) => Promise<readonly Record[]>,
  ) {
    this.index = index;
    this.#baseUrl = baseUrl;
    this.#readChunk = readChunk;
  }

  /** Load the index from `baseUrl` (ending with a slash) and check it is a `kind` catalog. */
  static async load<const Schema extends v.GenericSchema<unknown, CatalogRecord>>(
    baseUrl: string,
    fetchJson: Fetch,
    kind: CatalogKind,
    recordSchema: Schema,
  ): Promise<EclipseCatalog<v.InferOutput<Schema>>> {
    const index = await getJson(fetchJson, `${baseUrl}index.json`, IndexSchema);
    if (index.kind !== kind) {
      throw new CatalogError(`${baseUrl}index.json is a ${index.kind} catalog, not ${kind}`);
    }
    const chunkSchema = v.array(recordSchema);
    return new EclipseCatalog(index, baseUrl, (url) => getJson(fetchJson, url, chunkSchema));
  }

  covers(year: AstronomicalYear): boolean {
    return year >= this.index.startYear && year <= this.index.endYear;
  }

  /**
   * Every eclipse whose greatest eclipse falls in `year` in Universal Time, in time order.
   *
   * Files are grouped by year in TT, which runs ahead of UT by ΔT (over a day in 4000 BCE).
   * An eclipse early on 1 January TT can belong to the previous year in UT, so the following
   * year's file is read as well when it is a different one.
   */
  async eclipsesInYear(year: AstronomicalYear): Promise<readonly Record[]> {
    if (!this.covers(year)) {
      throw new RangeError(
        `${formatYear(year)} is outside the catalog (${String(this.index.startYear)} to ${String(this.index.endYear)})`,
      );
    }
    const size = this.index.yearsPerChunk;
    const starts = new Set(
      [year, Math.min(year + 1, this.index.endYear)].map((y) => Math.floor(y / size) * size),
    );
    const chunks = await Promise.all([...starts].map((start) => this.#chunk(start)));
    return chunks.flat().filter((eclipse) => yearOf(greatestEclipseUT(eclipse)) === year);
  }

  #chunk(startYear: number): Promise<readonly Record[]> {
    let pending = this.#chunks.get(startYear);
    if (pending === undefined) {
      const entry = this.index.chunks.find((chunk) => chunk.startYear === startYear);
      if (entry === undefined) {
        return Promise.reject(new CatalogError(`Index lists no chunk for ${String(startYear)}`));
      }
      pending = this.#readChunk(`${this.#baseUrl}${entry.file}`);
      // Drop failed loads from the cache so a later call can retry.
      void pending.catch(() => this.#chunks.delete(startYear));
      this.#chunks.set(startYear, pending);
    }
    return pending;
  }
}
