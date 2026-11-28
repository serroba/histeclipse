/**
 * Pictures for the animals' stories (`public/data/life-stories/pictures.json`), by the
 * pipeline's `life_pictures`: for a kind or a lineage by name, a silhouette from
 * PhyloPic, and its Wikipedia page with the page's lead picture where Wikimedia Commons has it
 * under a free licence. Each is shown from where it lives, with its author and licence.
 */

import * as v from 'valibot';

import { HEADER } from '../../data/header';
import { getJson, type Fetch } from '../../util/fetchJson';

const https = v.pipe(v.string(), v.url(), v.startsWith('https://'));

const PicturesSchema = v.strictObject({
  schemaVersion: v.literal(1),
  ...HEADER,
  phylopicBuild: v.pipe(v.number(), v.integer(), v.minValue(0)),
  names: v.record(
    v.string(),
    v.strictObject({
      silhouette: v.nullable(
        v.strictObject({
          src: v.pipe(https, v.startsWith('https://images.phylopic.org/')),
          /** The taxon the silhouette is of: the name itself, or a species in it. */
          of: v.pipe(v.string(), v.minLength(1)),
          by: v.pipe(v.string(), v.minLength(1)),
          licence: v.pipe(v.string(), v.minLength(1)),
          licenceUrl: v.pipe(https, v.startsWith('https://creativecommons.org/')),
          page: v.pipe(https, v.startsWith('https://www.phylopic.org/')),
        }),
      ),
      wikipedia: v.nullable(
        v.strictObject({
          page: v.pipe(https, v.startsWith('https://en.wikipedia.org/')),
          image: v.nullable(
            v.strictObject({
              src: v.pipe(https, v.regex(/^https:\/\/(upload|thumb)\.wikimedia\.org\//)),
              width: v.pipe(v.number(), v.integer(), v.gtValue(0)),
              height: v.pipe(v.number(), v.integer(), v.gtValue(0)),
              artist: v.pipe(v.string(), v.minLength(1)),
              licence: v.pipe(v.string(), v.minLength(1)),
              licenceUrl: v.nullable(v.string()),
              filePage: v.pipe(https, v.startsWith('https://commons.wikimedia.org/')),
            }),
          ),
        }),
      ),
    }),
  ),
});

export type LifePictures = v.InferOutput<typeof PicturesSchema>;
export type LifePicture = LifePictures['names'][string];
export type Silhouette = NonNullable<LifePicture['silhouette']>;

export async function loadLifePictures(url: string, fetchJson: Fetch): Promise<LifePictures> {
  return getJson(fetchJson, url, PicturesSchema);
}

/** A silhouette's credit: whom it is of, by whom, under what. */
export function silhouetteCredit(silhouette: Silhouette): string {
  return `${silhouette.of}, by ${silhouette.by}, ${silhouette.licence}`;
}
