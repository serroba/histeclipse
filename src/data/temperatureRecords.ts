/**
 * Global surface temperature, record by record (#526), as `temperature-records/index.json` has
 * it: HadCRUT5, Berkeley Earth, NOAAGlobalTemp, GISTEMP, and the reanalyses ERA5 and JRA-3Q,
 * each on the 1850–1900 baseline (shifted as AR6 does where a record starts later), with its
 * 95% range where it gives one, and the spread between them year by year. None is picked: the
 * site shows where they agree and where they do not.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';

const year = v.pipe(v.number(), v.integer());
const text = v.pipe(v.string(), v.minLength(1));
const value = v.nullable(v.number());

const RecordsSchema = v.strictObject({
  schemaVersion: v.literal(1),
  units: v.literal('°C'),
  baseline: text,
  lastYear: year,
  credit: text,
  source: v.array(v.pipe(v.string(), v.url())),
  range: text,
  series: v.array(
    v.strictObject({
      id: text,
      name: text,
      kind: v.picklist(['station and ship record', 'reanalysis']),
      sourceId: text,
      credit: text,
      source: v.pipe(v.string(), v.url()),
      ownBaseline: text,
      baseline: text,
      shift: v.number(),
      note: text,
      points: v.array(v.tuple([year, v.number(), value, value])),
    }),
  ),
  /** Each year: the lowest and highest of the records, and how many have it. */
  spread: v.array(v.tuple([year, v.number(), v.number(), v.pipe(v.number(), v.integer())])),
});

export type TemperatureRecords = v.InferOutput<typeof RecordsSchema>;
export type TemperatureRecord = TemperatureRecords['series'][number];

export async function loadTemperatureRecords(
  url: string,
  fetchJson: Fetch,
): Promise<TemperatureRecords> {
  return getJson(fetchJson, url, RecordsSchema);
}

/** What each record says of a year, in the file's order; a record without the year is left out. */
export function recordsIn(
  records: TemperatureRecords,
  at: number,
): { readonly record: TemperatureRecord; readonly anomaly: number }[] {
  return records.series.flatMap((record) => {
    const point = record.points.find(([each]) => each === at);
    return point === undefined ? [] : [{ record, anomaly: point[1] }];
  });
}

const signed = (anomaly: number): string =>
  `${anomaly < 0 ? '−' : '+'}${Math.abs(anomaly).toFixed(2)}`;

/** The year in words: the records' values and how far apart they are. */
export function recordsText(records: TemperatureRecords, at: number): string {
  const said = recordsIn(records, at);
  const first = records.spread[0]?.[0] ?? records.lastYear;
  if (said.length === 0) {
    return `The records run from ${String(first)} to ${String(records.lastYear)}: none for ${String(at)}.`;
  }
  const values = said.map(({ anomaly }) => anomaly);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const each = said.map(({ record, anomaly }) => `${record.name} ${signed(anomaly)}`).join('; ');
  const apart = said.length === 1 ? '' : ` They are ${(high - low).toFixed(2)} °C apart.`;
  return `${String(at)}, °C above 1850–1900: ${each}.${apart}`;
}

/** The year in a few words, for the chart's panel: how far the records range. */
export function recordsLine(records: TemperatureRecords, at: number): string {
  const values = recordsIn(records, at).map(({ anomaly }) => anomaly);
  if (values.length === 0) return `No record for ${String(at)}.`;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = low === high ? signed(low) : `${signed(low)} to ${signed(high)}`;
  return `${String(at)}: ${range} °C, ${String(values.length)} record${values.length === 1 ? '' : 's'}.`;
}
