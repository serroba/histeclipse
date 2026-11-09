/**
 * The colour keys (`public/data/planet-keys.json`, #334), written by the pipeline's
 * `planet-keys` command. The height views': for Mars and the Moon, measured against MOLA and
 * LOLA heights; for Venus, read off USGS Astrogeology's legend; each stop a height in km and the
 * colour the map gives it. The enhanced-colour views' (the Moon's, Mercury's): swatches, each a
 * kind of rock and the colour the map gives a place known for it.
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from './fetchJson';

const KeySchema = v.pipe(
  v.strictObject({
    datum: v.pipe(v.string(), v.minLength(1)),
    credit: v.pipe(v.string(), v.minLength(1)),
    source: v.pipe(v.string(), v.url()),
    stops: v.pipe(
      v.array(v.tuple([v.number(), v.pipe(v.string(), v.regex(/^#[0-9a-f]{6}$/))])),
      v.minLength(2),
    ),
  }),
  v.check(
    (key) => key.stops.every(([km], i) => i === 0 || elementAt(key.stops, i - 1)[0] < km),
    'heights rise',
  ),
);

const SwatchKeySchema = v.strictObject({
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  swatches: v.pipe(
    v.array(
      v.strictObject({
        kind: v.pipe(v.string(), v.minLength(1)),
        place: v.pipe(v.string(), v.minLength(1)),
        colour: v.pipe(v.string(), v.regex(/^#[0-9a-f]{6}$/)),
      }),
    ),
    v.minLength(2),
  ),
});

const KeysSchema = v.strictObject({
  schemaVersion: v.literal(2),
  keys: v.strictObject({ mars: KeySchema, moon: KeySchema, venus: KeySchema }),
  swatches: v.strictObject({ moon: SwatchKeySchema, mercury: SwatchKeySchema }),
});

export type ColourKey = v.InferOutput<typeof KeySchema>;
export type SwatchKey = v.InferOutput<typeof SwatchKeySchema>;
export type ColourKeys = v.InferOutput<typeof KeysSchema>['keys'];
export type SwatchKeys = v.InferOutput<typeof KeysSchema>['swatches'];
export type KeyedBody = keyof ColourKeys;
export type SwatchedBody = keyof SwatchKeys;

export async function loadColourKeys(
  url: string,
  fetchJson: Fetch,
): Promise<{ readonly heights: ColourKeys; readonly rocks: SwatchKeys }> {
  const { keys, swatches } = await getJson(fetchJson, url, KeysSchema);
  return { heights: keys, rocks: swatches };
}

/** The key as a CSS gradient, left to right, each stop at its share of the heights' range. */
export function keyGradient(key: ColourKey): string {
  const [low, high] = keyRange(key);
  const stops = key.stops.map(
    ([km, colour]) => `${colour} ${String(Math.round((1000 * (km - low)) / (high - low)) / 10)}%`,
  );
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/** The heights the key runs between, km: its first stop and its last. */
export function keyRange(key: ColourKey): readonly [number, number] {
  return [elementAt(key.stops, 0)[0], elementAt(key.stops, key.stops.length - 1)[0]];
}

/**
 * The heights to label under the key: round numbers a whole step apart, the step the smallest
 * of 1, 2, 4, 5 or 10 km that leaves no more than `most` labels; each written with its sign
 * ("−4", "0", "+8", the last with its unit) and its share of the way across.
 */
export function keyTicks(
  key: ColourKey,
  most = 7,
): readonly { readonly km: number; readonly label: string; readonly at: number }[] {
  const [low, high] = keyRange(key);
  const count = (each: number): number => Math.floor(high / each) - Math.ceil(low / each) + 1;
  const step = [1, 2, 4, 5, 10].find((each) => count(each) <= most) ?? 10;
  const kms = [];
  // (+ 0 turns −0 into 0.)
  for (let km = Math.ceil(low / step) * step + 0; km <= high; km += step) kms.push(km);
  return kms.map((km, index) => ({
    km,
    label: `${km < 0 ? '−' : km > 0 ? '+' : ''}${String(Math.abs(km))}${index === kms.length - 1 ? ' km' : ''}`,
    at: (km - low) / (high - low),
  }));
}
