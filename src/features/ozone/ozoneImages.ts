/**
 * Each October's map of ozone (#722), fetched the first time its year is shown and kept: a
 * year's image is a few kilobytes, and time plays through many years.
 */

import { mapOf, type OzoneMaps } from '../../data/ozoneMaps';
import { loadImage } from '../../util/loadImage';
import type { OzoneMapImage } from './ozoneLayer';

/**
 * The year's October once its image has come, null until then or if the reanalysis lacks the
 * year; `arrived` hears when one comes. One that cannot be fetched is not asked for again: the
 * hole's cap stays, the map being the finer picture, not the only one.
 */
export function ozoneImages(
  base: string,
  arrived: () => void,
  load: typeof loadImage = loadImage,
): (maps: OzoneMaps, year: number) => OzoneMapImage | null {
  // There, still coming (null), or never (false).
  const images = new Map<number, OzoneMapImage | null | false>();
  return (maps, year) => {
    const known = images.get(year);
    if (known !== undefined) return known === false ? null : known;
    const found = mapOf(maps, year);
    if (found === null) return null;
    images.set(year, null);
    load(`${base}data/ozone/${found.file}`).then(
      (image) => {
        images.set(year, { year, image, encoding: maps.encoding });
        arrived();
      },
      () => {
        images.set(year, false);
      },
    );
    return null;
  };
}
