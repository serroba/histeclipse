/**
 * What the ways of life have at one place, for "Why here?": the region rated there, read back
 * from the records the map is shaded from. Pure.
 */

import { WAY_NAMES, type WaysAt } from '../../data/waysOfLife';
import type { HereFact } from '../../sources/registry';
import type { GeoPoint } from '../../state/viewState';
import { insideWrapped } from '../../util/polygons';

const LEVEL_WORDS = { 1: 'present but minimal', 2: 'common', 3: 'widespread' } as const;

/** The region rated at the place, at the moment rated nearest: `momentText` is its year. */
export function waysFact(at: WaysAt, place: GeoPoint, momentText: string): HereFact {
  const region = at.regions.find((each) =>
    insideWrapped(each.rings, place.longitude, place.latitude),
  );
  return region === undefined
    ? {
        title: 'Ways of life',
        text: `ArchaeoGLOBE rates no region here for ${momentText}.`,
        why: 'ways',
      }
    : {
        title: 'Ways of life',
        text: `${region.name}: ${region.ways.map((way) => WAY_NAMES[way]).join(' and ')}, ${LEVEL_WORDS[region.level]}, as archaeologists rated it for ${momentText}.`,
        why: 'ways',
      };
}
