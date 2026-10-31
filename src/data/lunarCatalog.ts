/**
 * The lunar eclipse catalog the data pipeline writes to `public/data/lunar/`.
 *
 * Runtime schemas mirror `data-pipeline/src/histeclipse_pipeline/catalog.py`. Every file
 * is validated when loaded, so a pipeline/app mismatch fails loudly instead of rendering
 * wrong data.
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

const finite = v.pipe(v.number(), v.finite());
const integer = v.pipe(v.number(), v.integer());

const LunarEclipseSchema = v.strictObject({
  /** Greatest eclipse, Terrestrial Time. Subtract `deltaT` seconds for Universal Time. */
  jdTT: v.pipe(finite, v.minValue(0), v.transform(julianDayNumber)),
  kind: v.picklist(['penumbral', 'partial', 'total']),
  umbralMagnitude: finite,
  penumbralMagnitude: finite,
  /** Moon's distance from the shadow axis in Earth radii; positive when it passes north. */
  gamma: finite,
  /** TT − UT in seconds, from the model named in the index. */
  deltaT: integer,
  /** Where the Moon is overhead at greatest eclipse: [latitude, longitude] in degrees. */
  sublunar: v.tuple([
    v.pipe(finite, v.minValue(-90), v.maxValue(90)),
    v.pipe(finite, v.minValue(-180), v.maxValue(180)),
  ]),
});

const ChunkSchema = v.array(LunarEclipseSchema);

const IndexSchema = v.strictObject({
  schemaVersion: v.literal(1),
  kind: v.literal('lunar'),
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

export type LunarEclipse = v.InferOutput<typeof LunarEclipseSchema>;
export type LunarEclipseKind = LunarEclipse['kind'];
export type LunarCatalogIndex = v.InferOutput<typeof IndexSchema>;

/** The astronomical year of a Julian Day, in the calendar in use at the time. */
export function yearOf(jd: JulianDay): AstronomicalYear {
  return calendarDate(jd, historicalCalendar(jd)).year;
}

/** Greatest eclipse in Universal Time, using the ΔT the catalog computed it with. */
export function greatestEclipseUT(eclipse: LunarEclipse): JulianDay {
  return julianDayNumber(eclipse.jdTT - eclipse.deltaT / 86_400);
}

export class LunarCatalog {
  readonly index: LunarCatalogIndex;
  readonly #baseUrl: string;
  readonly #fetch: Fetch;
  readonly #chunks = new Map<number, Promise<readonly LunarEclipse[]>>();

  private constructor(index: LunarCatalogIndex, baseUrl: string, fetchJson: Fetch) {
    this.index = index;
    this.#baseUrl = baseUrl;
    this.#fetch = fetchJson;
  }

  /** Load the catalog index from `baseUrl` (which must end with a slash). */
  static async load(baseUrl: string, fetchJson: Fetch): Promise<LunarCatalog> {
    const index = await getJson(fetchJson, `${baseUrl}index.json`, IndexSchema);
    return new LunarCatalog(index, baseUrl, fetchJson);
  }

  covers(year: AstronomicalYear): boolean {
    return year >= this.index.startYear && year <= this.index.endYear;
  }

  /**
   * Every lunar eclipse whose greatest eclipse falls in `year` in Universal Time, in time order.
   *
   * Files are grouped by year in TT, which runs ahead of UT by ΔT (over a day in 4000 BCE).
   * An eclipse early on 1 January TT can belong to the previous year in UT, so the following
   * year's file is read as well when it is a different one.
   */
  async eclipsesInYear(year: AstronomicalYear): Promise<readonly LunarEclipse[]> {
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

  #chunk(startYear: number): Promise<readonly LunarEclipse[]> {
    let pending = this.#chunks.get(startYear);
    if (pending === undefined) {
      const entry = this.index.chunks.find((chunk) => chunk.startYear === startYear);
      if (entry === undefined) {
        return Promise.reject(new CatalogError(`Index lists no chunk for ${String(startYear)}`));
      }
      pending = getJson(this.#fetch, `${this.#baseUrl}${entry.file}`, ChunkSchema);
      // Drop failed loads from the cache so a later call can retry.
      void pending.catch(() => this.#chunks.delete(startYear));
      this.#chunks.set(startYear, pending);
    }
    return pending;
  }
}
