/**
 * Every reversal of Earth's magnetic field over the last 83 million years
 * (`public/data/polarity.json`): the geomagnetic polarity time scale of GTS 2020 (Ogg 2020), as
 * PmagPy carries it, written by the pipeline's `polarity` command. Today's field is normal; each
 * boundary, oldest last, swaps it.
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from './fetchJson';

const PolaritySchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  boundaries: v.pipe(
    v.array(v.pipe(v.number(), v.minValue(0))),
    v.minLength(2),
    v.check((ages) => ages[0] === 0, 'the first boundary is today'),
    v.check(
      (ages) => ages.every((age, i) => i === 0 || elementAt(ages, i - 1) < age),
      'boundaries rise',
    ),
  ),
  chrons: v.array(v.strictObject({ name: v.string(), young: v.number() })),
});

export type PolarityScale = v.InferOutput<typeof PolaritySchema>;

export async function loadPolarity(url: string, fetchJson: Fetch): Promise<PolarityScale> {
  return getJson(fetchJson, url, PolaritySchema);
}

/** How far back the scale reaches, Ma: the start of the Cretaceous Normal Superchron. */
export function scaleEnd(scale: PolarityScale): number {
  return elementAt(scale.boundaries, scale.boundaries.length - 1);
}

/** The field's polarity `ma` million years ago, within the scale; null beyond it. */
export function scalePolarity(scale: PolarityScale, ma: number): 'normal' | 'reversed' | null {
  const { boundaries } = scale;
  if (ma < 0 || ma > scaleEnd(scale)) return null;
  // The interval holding `ma`: today's (index 0) is normal, and each one older swaps.
  const index = boundaries.findIndex((age) => age > ma) - 1;
  const interval = index < 0 ? boundaries.length - 2 : index;
  return interval % 2 === 0 ? 'normal' : 'reversed';
}

/** The chron `ma` million years ago lies in, such as C29r, within the scale. */
export function chronAt(scale: PolarityScale, ma: number): string | null {
  if (ma < 0 || ma > scaleEnd(scale)) return null;
  return scale.chrons.findLast(({ young }) => young <= ma)?.name ?? null;
}
