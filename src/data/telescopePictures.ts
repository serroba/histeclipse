/**
 * Famous pictures by the space telescopes, for their cards (#798): made by the pipeline's
 * `telescope-pictures` command from ESA's outreach sites, which release them under CC BY 4.0.
 * Each is served by the site itself, a small square for the card and a larger copy to open.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';
import { writtenDate } from './craftCard';

const words = v.pipe(v.string(), v.minLength(1));
const own = v.pipe(v.string(), v.regex(/^pictures\/[a-z]+\/[a-z0-9-]+\.webp$/));
const web = v.pipe(v.string(), v.url(), v.startsWith('https://'));
const size = v.pipe(v.number(), v.integer(), v.gtValue(0));

const TelescopePicturesSchema = v.strictObject({
  schemaVersion: v.literal(1),
  /** By the craft's id in the spacecraft record. */
  telescopes: v.record(
    v.string(),
    v.strictObject({
      name: words,
      source: words,
      licence: words,
      licenceUrl: web,
      pictures: v.pipe(
        v.array(
          v.strictObject({
            key: words,
            title: words,
            released: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
            about: words,
            alt: words,
            credit: words,
            page: web,
            thumb: own,
            large: own,
            width: size,
            height: size,
          }),
        ),
        v.minLength(1),
      ),
    }),
  ),
});

export type TelescopePictures = v.InferOutput<typeof TelescopePicturesSchema>;

/** A craft's pictures as its card shows them: each with its date as written. */
export interface CraftPictureSet {
  readonly heading: string;
  readonly source: string;
  readonly licence: string;
  readonly licenceUrl: string;
  readonly pictures: readonly {
    readonly title: string;
    readonly released: string;
    readonly about: string;
    readonly alt: string;
    readonly credit: string;
    readonly page: string;
    readonly thumb: string;
    readonly large: string;
    readonly width: number;
    readonly height: number;
  }[];
}

export async function loadTelescopePictures(
  url: string,
  fetchJson: Fetch,
): Promise<TelescopePictures> {
  return getJson(fetchJson, url, TelescopePicturesSchema);
}

/** A craft's pictures for its card, each file from the site's `base`; none for most craft. */
export function picturesOf(
  all: TelescopePictures | null,
  craft: string,
  base: string,
): CraftPictureSet | undefined {
  const telescope = all?.telescopes[craft];
  if (telescope === undefined) return undefined;
  return {
    heading: 'Pictures it took',
    source: telescope.source,
    licence: telescope.licence,
    licenceUrl: telescope.licenceUrl,
    pictures: telescope.pictures.map((picture) => ({
      title: picture.title,
      released: writtenDate(picture.released),
      about: picture.about,
      alt: picture.alt,
      credit: picture.credit,
      page: picture.page,
      thumb: `${base}${picture.thumb}`,
      large: `${base}${picture.large}`,
      width: picture.width,
      height: picture.height,
    })),
  };
}
