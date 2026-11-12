/**
 * CO2 estimates of the last 455 million years, by method (`public/data/air-co2-archive.json`),
 * from the Paleo-CO2 Data Archive (CO2PIP community, CC BY 4.0) by the pipeline's `co2-archive`
 * command: each estimate's age, CO2 and range, the method behind it and the study that made it.
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from '../util/fetchJson';

const index = v.pipe(v.number(), v.integer(), v.minValue(0));
const ppm = v.pipe(v.number(), v.minValue(0));

const Co2ArchiveSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  methods: v.pipe(v.array(v.pipe(v.string(), v.minLength(1))), v.minLength(1)),
  studies: v.array(
    v.strictObject({
      author: v.string(),
      year: v.nullable(v.pipe(v.number(), v.integer())),
      doi: v.nullable(v.pipe(v.string(), v.minLength(1))),
    }),
  ),
  /** Each: Ma, ppm, low, high (null where not given), method, study; youngest first. */
  estimates: v.array(
    v.tuple([
      v.pipe(v.number(), v.minValue(0)),
      ppm,
      v.nullable(ppm),
      v.nullable(ppm),
      index,
      index,
    ]),
  ),
});

export type Co2Archive = v.InferOutput<typeof Co2ArchiveSchema>;

export async function loadCo2Archive(url: string, fetchJson: Fetch): Promise<Co2Archive> {
  return getJson(fetchJson, url, Co2ArchiveSchema);
}

/** The estimates of one method (its index), or of all (null), as [Ma, ppm] for a chart's dots. */
export function archiveDots(
  data: Co2Archive,
  method: number | null,
): readonly (readonly [number, number])[] {
  return data.estimates.flatMap(([at, value, , , by]) =>
    method === null || by === method ? [[at, value] as const] : [],
  );
}

/** The estimates within `window` million years of `ma`, of one method or all. */
function near(data: Co2Archive, ma: number, window: number, method: number | null) {
  return data.estimates.filter(
    ([at, , , , by]) => Math.abs(at - ma) <= window && (method === null || by === method),
  );
}

/** How many estimates of each method lie within `window` million years of `ma`, most first. */
export function archiveNear(
  data: Co2Archive,
  ma: number,
  window: number,
): readonly { readonly name: string; readonly count: number }[] {
  const counts = new Map<number, number>();
  for (const [, , , , by] of near(data, ma, window, null)) {
    counts.set(by, (counts.get(by) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([by, count]) => ({ name: elementAt(data.methods, by), count }));
}

/** The studies behind the estimates near `ma` (of one method or all), most estimates first. */
export function studiesNear(
  data: Co2Archive,
  ma: number,
  window: number,
  method: number | null,
): readonly { readonly label: string; readonly doi: string | null; readonly count: number }[] {
  const counts = new Map<number, number>();
  for (const [, , , , , study] of near(data, ma, window, method)) {
    counts.set(study, (counts.get(study) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([at, count]) => {
      const study = elementAt(data.studies, at);
      const author = study.author === '' ? 'Unnamed study' : study.author;
      const label = study.year === null ? author : `${author} ${String(study.year)}`;
      return { label, doi: study.doi, count };
    });
}

/** The middle of the estimates near `ma` (of one method or all), ppm; null with none near. */
export function medianNear(
  data: Co2Archive,
  ma: number,
  window: number,
  method: number | null,
): number | null {
  const values = near(data, ma, window, method)
    .map(([, value]) => value)
    .sort((a, b) => a - b);
  if (values.length === 0) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 1
    ? elementAt(values, middle)
    : (elementAt(values, middle - 1) + elementAt(values, middle)) / 2;
}

/** What the bar says of the archive's estimates near the moment shown. */
export function archiveText(
  data: Co2Archive,
  ma: number,
  window: number,
  method: number | null,
): string {
  const which = method === null ? '' : ` by ${elementAt(data.methods, method)}`;
  const median = medianNear(data, ma, window, method);
  if (median === null) {
    return `The Paleo-CO₂ Data Archive has no estimates${which} within ${String(window)} million years of then.`;
  }
  const count = near(data, ma, window, method).length;
  const methods =
    method === null
      ? ` By method: ${archiveNear(data, ma, window)
          .map(({ name, count: n }) => `${name} ${String(n)}`)
          .join(', ')}.`
      : '';
  return `The Paleo-CO₂ Data Archive: ${count.toLocaleString('en')} estimates${which} within ${String(window)} million years of then, their middle ${Math.round(median).toLocaleString('en')} ppm.${methods} Each method has its own assumptions; where they part, the archive keeps both.`;
}
