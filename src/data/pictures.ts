/**
 * Pictures for the cards (such as `public/data/humans/pictures.json`), by the pipeline's
 * `pictures` command: for each Wikipedia page a data file names, its address and, where its lead
 * image is freely licensed on Wikimedia Commons, a thumbnail with its author and licence.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from './fetchJson';

const wikimedia = v.pipe(v.string(), v.url(), v.startsWith('https://'));

const PicturesSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  made: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  pictures: v.record(
    v.string(),
    v.strictObject({
      page: v.pipe(wikimedia, v.startsWith('https://en.wikipedia.org/')),
      image: v.nullable(
        v.strictObject({
          src: v.pipe(wikimedia, v.regex(/^https:\/\/(upload|thumb)\.wikimedia\.org\//)),
          width: v.pipe(v.number(), v.integer(), v.gtValue(0)),
          height: v.pipe(v.number(), v.integer(), v.gtValue(0)),
          artist: v.pipe(v.string(), v.minLength(1)),
          licence: v.pipe(v.string(), v.minLength(1)),
          licenceUrl: v.nullable(v.string()),
          filePage: v.pipe(wikimedia, v.startsWith('https://commons.wikimedia.org/')),
        }),
      ),
    }),
  ),
});

export type Pictures = v.InferOutput<typeof PicturesSchema>;

export async function loadPictures(url: string, fetchJson: Fetch): Promise<Pictures> {
  return getJson(fetchJson, url, PicturesSchema);
}

/**
 * A card's picture and its credit, and its links (the Wikipedia page, and the picture's own page,
 * with its licence), for a title; nothing if unknown.
 */
export function pictureFor(
  pictures: Pictures | null,
  title: string | undefined,
  alt: string,
): {
  readonly image?: { readonly src: string; readonly alt: string; readonly credit: string };
  readonly links: readonly { readonly label: string; readonly href: string }[];
} {
  const entry = title === undefined ? undefined : pictures?.pictures[title];
  if (entry === undefined) return { links: [] };
  const page = { label: 'Wikipedia', href: entry.page };
  if (entry.image === null) return { links: [page] };
  return {
    links: [page, { label: 'The picture and its licence', href: entry.image.filePage }],
    image: {
      src: entry.image.src,
      alt,
      credit: `Picture: ${entry.image.artist}, ${entry.image.licence}, via Wikimedia Commons.`,
    },
  };
}
