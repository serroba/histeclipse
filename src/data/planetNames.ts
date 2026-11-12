/**
 * The place names on Mercury, Venus, the Moon and Mars (`public/data/planet-names.json`, #334),
 * written by the pipeline's `planet-names` command: the IAU's names for each body's largest
 * features, from the Gazetteer of Planetary Nomenclature, largest first.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';

const NameSchema = v.pipe(
  v.tuple([
    v.pipe(v.string(), v.minLength(1)),
    v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
    v.pipe(v.number(), v.minValue(0), v.maxValue(360)),
    v.pipe(v.number(), v.minValue(0)),
    v.pipe(v.string(), v.minLength(1)),
  ]),
  v.transform(([name, latitude, longitude, km, kind]) => ({
    name,
    point: { latitude, longitude },
    km,
    kind,
  })),
);

const NamesSchema = v.strictObject({
  schemaVersion: v.literal(1),
  source: v.pipe(v.string(), v.url()),
  names: v.strictObject({
    mercury: v.array(NameSchema),
    venus: v.array(NameSchema),
    moon: v.array(NameSchema),
    mars: v.array(NameSchema),
  }),
});

export type PlaceName = v.InferOutput<typeof NameSchema>;
export type PlaceNames = v.InferOutput<typeof NamesSchema>['names'];
export type NamedBody = keyof PlaceNames;

const NAMED_BODIES: readonly NamedBody[] = ['mercury', 'venus', 'moon', 'mars'];

export function isNamedBody(body: string): body is NamedBody {
  return (NAMED_BODIES as readonly string[]).includes(body);
}

export async function loadPlaceNames(url: string, fetchJson: Fetch): Promise<PlaceNames> {
  return (await getJson(fetchJson, url, NamesSchema)).names;
}

/** A name shows once its feature spans this many pixels: more names as the view zooms in. */
export const NAME_MIN_PIXELS = 40;

/**
 * Whether a feature is large enough on screen to be named: its diameter, in pixels, on a body
 * of `radiusKm` drawn `radiusPixels` across its radius.
 */
export function largeEnough(km: number, radiusKm: number, radiusPixels: number): boolean {
  return (km / radiusKm) * radiusPixels >= NAME_MIN_PIXELS;
}
