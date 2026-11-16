/**
 * Each season of the ozone surface (#804), fetched the first time one of its days is shown and
 * kept: a season is one image of some megabyte and a half, its days one under the other. Only
 * the last two seasons shown are kept, each some five megabytes once read.
 */

import {
  shellDayOf,
  shellField,
  type OzoneShell,
  type ShellDayOf,
  type ShellField,
} from '../../data/ozoneShell';
import { loadImage } from '../../util/loadImage';

/** A day's surface, and which day it is. */
export interface ShellDay {
  readonly of: ShellDayOf;
  readonly field: ShellField;
}

/** Read an image's pixels (RGBA bytes); null where the page cannot. */
export function imagePixels(image: HTMLImageElement): Uint8ClampedArray | null {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) return null;
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height).data;
}

/** The most seasons kept read. */
const KEPT = 2;

/**
 * The surface on a date once its season has come; null until then, on a date outside every
 * season, or if the season cannot be fetched (it is not asked for again). `arrived` hears when
 * a season comes.
 */
export function ozoneSeasons(
  base: string,
  arrived: () => void,
  read: (url: string) => Promise<Uint8ClampedArray | null> = async (url) =>
    imagePixels(await loadImage(url)),
): (
  shell: OzoneShell,
  date: { readonly year: number; readonly month: number; readonly day: number },
) => ShellDay | null {
  // There, still coming (null), or never (false).
  const seasons = new Map<number, Uint8ClampedArray | null | false>();
  let last: { readonly key: string; readonly day: ShellDay } | null = null;
  return (shell, date) => {
    const of = shellDayOf(shell, date);
    if (of === null) return null;
    const { year } = of.season;
    const known = seasons.get(year);
    if (known === undefined) {
      seasons.set(year, null);
      read(`${base}data/ozone/${of.season.file}`).then(
        (pixels) => {
          seasons.set(year, pixels ?? false);
          // The oldest read season is let go.
          const read = [...seasons].filter(([, each]) => each !== null && each !== false);
          const oldest = read[0];
          if (read.length > KEPT && oldest !== undefined) seasons.delete(oldest[0]);
          if (pixels !== null) arrived();
        },
        () => {
          seasons.set(year, false);
        },
      );
      return null;
    }
    if (known === null || known === false) return null;
    const key = `${String(year)}:${String(of.day)}`;
    if (last?.key !== key) last = { key, day: { of, field: shellField(shell, known, of.day) } };
    return last.day;
  };
}
