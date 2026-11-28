/**
 * What the "why" panel reads and nothing else does (#220): every why, and each source's full
 * reference. Loaded with the panel, not with the site: about 220 KB of text that the first view
 * never shows.
 */

import citationsJson from './citations.json' with { type: 'json' };
import { SOURCES, type SourceId, type Why, type WhyId } from './registry';
import { WHYS_CONTENT } from './whys';

// The whys are content, a file each in whys/ (#906); registry.test.ts checks each one's shape and
// that every source it names exists.
export const WHYS = WHYS_CONTENT as Readonly<Record<WhyId, Why>>;

/** Each source's full reference: authors, year, venue, version. */
export const CITATIONS = citationsJson as Readonly<Record<SourceId, string>>;

/** The reference to copy: the full citation, where to find it, and its licence. */
export function citation(id: SourceId): string {
  const source = SOURCES[id];
  const licence = source.licence === undefined ? '' : ` Licence: ${source.licence}.`;
  return `${CITATIONS[id]}. ${source.url}${licence}`;
}
