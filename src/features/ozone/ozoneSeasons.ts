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

/** The most seasons kept read: the one shown and the one each side of it. */
const KEPT = 3;

/** Run `run` when the page has nothing better to do (a season's decoding is a pause). */
export function whenIdle(run: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 300);
}

type Pixels = Uint8ClampedArray;

/**
 * The surface on a date once its season has come; null until then, on a date outside every
 * season, or if the season cannot be fetched (it is not asked for again). `arrived` hears when
 * a season comes.
 *
 * Playing through a season, the next is asked for ahead, and the one before for playing back,
 * once the season shown is read and the page is idle (#819): so the fetch and the decoding of an
 * image of five megabytes do not come as a stall at the turn of a season. Should a day's season
 * still be coming, the neighbouring season's last day shown stays, rather than the surface
 * blinking out.
 */
export function ozoneSeasons(
  base: string,
  arrived: () => void,
  read: (url: string) => Promise<Pixels | null> = async (url) => imagePixels(await loadImage(url)),
  later: (run: () => void) => void = whenIdle,
): (
  shell: OzoneShell,
  date: { readonly year: number; readonly month: number; readonly day: number },
) => ShellDay | null {
  // There, still coming (null), or never (false).
  const seasons = new Map<number, Pixels | null | false>();
  let focus = 0;
  let last: { readonly key: string; readonly day: ShellDay } | null = null;

  /** The read seasons furthest from the one shown are let go. */
  function evict(): void {
    const held = [...seasons].filter(([, each]) => each !== null && each !== false);
    held.sort(([a], [b]) => Math.abs(b - focus) - Math.abs(a - focus));
    for (const [year] of held.slice(0, Math.max(0, held.length - KEPT))) seasons.delete(year);
  }

  function ask(shell: OzoneShell, year: number): void {
    const season = shell.seasons.find((each) => each.year === year);
    if (season === undefined || seasons.has(year)) return;
    seasons.set(year, null);
    read(`${base}data/ozone/${season.file}`).then(
      (pixels) => {
        seasons.set(year, pixels ?? false);
        evict();
        if (pixels === null) return;
        arrived();
        if (year === focus) {
          later(() => {
            ask(shell, focus + 1);
            ask(shell, focus - 1);
          });
        }
      },
      () => {
        seasons.set(year, false);
      },
    );
  }

  return (shell, date) => {
    const of = shellDayOf(shell, date);
    if (of === null) return null;
    const { year } = of.season;
    focus = year;
    ask(shell, year);
    const known = seasons.get(year);
    if (known === null) {
      const near = last?.day.of.season.year;
      return near !== undefined && Math.abs(near - year) === 1 ? (last?.day ?? null) : null;
    }
    if (known === false || known === undefined) return null;
    const key = `${String(year)}:${String(of.day)}`;
    if (last?.key !== key) last = { key, day: { of, field: shellField(shell, known, of.day) } };
    return last.day;
  };
}
