/**
 * The strength of Earth's magnetic dipole over the last 55,000 years (`public/data/dipole.json`,
 * #269): GGF100k (Panovska, Constable & Korte 2018) every 50 years, written by the pipeline's
 * `dipole` command. A smooth model: others put the Laschamp low, about 41 ka, far lower.
 */

import * as v from 'valibot';

import { valueAt } from '../util/arrays';
import { getJson, type Fetch } from './fetchJson';

const DipoleSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
    credit: v.pipe(v.string(), v.minLength(1)),
    source: v.pipe(v.string(), v.url()),
    ka: v.pipe(v.array(v.pipe(v.number(), v.minValue(0))), v.minLength(2)),
    dipole: v.array(v.pipe(v.number(), v.minValue(0))),
  }),
  v.check((series) => series.ka.length === series.dipole.length, 'an age for each value'),
  v.check(
    (series) => series.ka.every((ka, i) => i === 0 || valueAt(series.ka, i - 1) < ka),
    'ages rise',
  ),
);

export type DipoleSeries = v.InferOutput<typeof DipoleSchema>;

export async function loadDipole(url: string, fetchJson: Fetch): Promise<DipoleSeries> {
  return getJson(fetchJson, url, DipoleSchema);
}

/**
 * The dipole moment `ka` thousand years before 1950, ×10²² A m², between the series' values;
 * after 1950, 1950's; null beyond the series.
 */
export function dipoleAt(series: DipoleSeries, ka: number): number | null {
  const { ka: ages, dipole } = series;
  if (ka <= valueAt(ages, 0)) return valueAt(dipole, 0);
  const after = ages.findIndex((age) => age >= ka);
  if (after === -1) return null;
  const young = valueAt(ages, after - 1);
  const old = valueAt(ages, after);
  const t = (ka - young) / (old - young);
  return valueAt(dipole, after - 1) + t * (valueAt(dipole, after) - valueAt(dipole, after - 1));
}
