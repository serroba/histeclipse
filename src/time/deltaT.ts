/**
 * ΔT = TT − UT: how far Earth's rotation (civil time) lags uniform time.
 *
 * Interpolates the table the data pipeline writes to `public/data/delta-t.json`, so the
 * browser and the eclipse catalogs use the same model. Uncertainty grows quickly before
 * the telescopic era (about ±8 minutes in 600 BCE), which shifts where on Earth an event
 * was seen by roughly 0.25° of longitude per minute.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../data/fetchJson';
import { elementAt } from '../util/arrays';
import { julianDayNumber, type JulianDay } from './julianDay';

const finite = v.pipe(v.number(), v.finite());
const integer = v.pipe(v.number(), v.integer());

const TableSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    model: v.string(),
    uncertaintyModel: v.string(),
    startYear: integer,
    stepYears: v.pipe(integer, v.minValue(1)),
    seconds: v.pipe(v.array(finite), v.minLength(2)),
    uncertaintySeconds: v.array(v.pipe(finite, v.minValue(0))),
  }),
  v.check(
    (table) => table.seconds.length === table.uncertaintySeconds.length,
    'seconds and uncertaintySeconds must have the same length',
  ),
);

export type DeltaTTable = v.InferOutput<typeof TableSchema>;

const J2000 = 2_451_545;
const DAYS_PER_JULIAN_YEAR = 365.25;
const SECONDS_PER_DAY = 86_400;

export class DeltaT {
  readonly table: DeltaTTable;

  /** Validates `table` against the schema, so raw JSON can be passed straight in. */
  constructor(table: unknown) {
    this.table = v.parse(TableSchema, table);
  }

  static async load(url: string, fetchJson: Fetch): Promise<DeltaT> {
    return new DeltaT(await getJson(fetchJson, url, TableSchema));
  }

  get firstYear(): number {
    return this.table.startYear;
  }

  get lastYear(): number {
    return this.table.startYear + (this.table.seconds.length - 1) * this.table.stepYears;
  }

  /** ΔT in seconds at `jd`. The table is sampled in TT, but ΔT changes too slowly for UT/TT to matter. */
  seconds(jd: JulianDay): number {
    return this.#interpolate(this.table.seconds, jd);
  }

  /** Approximate one-sigma uncertainty of ΔT at `jd`, in seconds. */
  uncertaintySeconds(jd: JulianDay): number {
    return this.#interpolate(this.table.uncertaintySeconds, jd);
  }

  terrestrialTime(universal: JulianDay): JulianDay {
    return julianDayNumber(universal + this.seconds(universal) / SECONDS_PER_DAY);
  }

  universalTime(terrestrial: JulianDay): JulianDay {
    return julianDayNumber(terrestrial - this.seconds(terrestrial) / SECONDS_PER_DAY);
  }

  #interpolate(samples: readonly number[], jd: JulianDay): number {
    const year = 2000 + (jd - J2000) / DAYS_PER_JULIAN_YEAR;
    if (year < this.firstYear || year > this.lastYear) {
      throw new RangeError(
        `ΔT is tabulated for ${String(this.firstYear)} to ${String(this.lastYear)}, not ${year.toFixed(1)}`,
      );
    }
    const position = (year - this.table.startYear) / this.table.stepYears;
    const index = Math.min(Math.floor(position), samples.length - 2);
    const before = elementAt(samples, index);
    const after = elementAt(samples, index + 1);
    return before + (after - before) * (position - index);
  }
}
