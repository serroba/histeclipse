/**
 * Maps a month each, painted as the month shown changes (#886, #590): their index loaded with
 * the layer, then each month's image, the last few kept so stepping back and forth costs
 * nothing, and the next few fetched ahead (#915). While a month's image loads, the one before
 * stays painted, so playing through the months does not flicker; where there is no map for the
 * month, nothing is.
 */

import { errorMessage } from '../util/errors';
import { loadImage } from '../util/loadImage';
import type { PackedMonth } from './packedMaps';

/** How many months' images are kept. */
const KEPT = 36;
/** How many months after the one shown are fetched ahead, so playing need not wait for them. */
const AHEAD = 3;

export interface MonthlyMapsContext<Index> {
  readonly folder: string;
  /** Loads the maps' index. */
  readonly load: () => Promise<Index>;
  /** A month's file under `folder` (months since January of year 0), or null where none. */
  readonly file: (index: Index, at: number) => string | null;
  /** How a map is drawn: its bound, and its colours if not the sea's. */
  readonly look: (index: Index) => Omit<PackedMonth, 'image'>;
  /** What failed, in words: `the sea temperature map`, and its plural. */
  readonly names: { readonly map: string; readonly maps: string };
  readonly paint: (packed: PackedMonth | null) => void;
  readonly notify: (message: string) => void;
  /** Asks for the feature to be shown again: the index has loaded. */
  readonly refresh: () => void;
}

export interface MonthlyMaps<Index> {
  /** Paints the month (months since January of year 0), or nothing when `on` is false. */
  show(on: boolean, at: number): void;
  /** The maps' index once loaded, for the legend. */
  readonly index: () => Index | null;
  /** The month's image last asked for, if it has loaded. */
  readonly current: () => PackedMonth | null;
}

export function monthlyMaps<Index>(context: MonthlyMapsContext<Index>): MonthlyMaps<Index> {
  let index: Index | null = null;
  let asked = false;
  const kept = new Map<string, PackedMonth>();
  const loading = new Set<string>();
  let wanted: string | null = null;

  function keep(file: string, packed: PackedMonth): void {
    kept.delete(file);
    kept.set(file, packed);
    for (const old of kept.keys()) {
      if (kept.size <= KEPT) break;
      kept.delete(old);
    }
  }

  function fetchMonth(maps: Index, file: string): void {
    if (loading.has(file)) return;
    loading.add(file);
    loadImage(`${context.folder}${file}`).then(
      (image) => {
        loading.delete(file);
        const packed = { ...context.look(maps), image };
        keep(file, packed);
        if (wanted === file) context.paint(packed);
      },
      (error: unknown) => {
        loading.delete(file);
        context.notify(`Could not load ${context.names.map}: ${errorMessage(error)}`);
      },
    );
  }

  return {
    show(on, at) {
      if (!on) {
        wanted = null;
        context.paint(null);
        return;
      }
      if (index === null) {
        if (!asked) {
          asked = true;
          context.load().then(
            (loaded) => {
              index = loaded;
              context.refresh();
            },
            (error: unknown) => {
              asked = false;
              context.notify(`Could not load ${context.names.maps}: ${errorMessage(error)}`);
            },
          );
        }
        return;
      }
      wanted = context.file(index, at);
      if (wanted === null) {
        context.paint(null);
        return;
      }
      const packed = kept.get(wanted);
      if (packed === undefined) fetchMonth(index, wanted);
      else context.paint(packed);
      for (let ahead = 1; ahead <= AHEAD; ahead += 1) {
        const next = context.file(index, at + ahead);
        if (next !== null && next !== wanted && !kept.has(next)) fetchMonth(index, next);
      }
    },
    index: () => index,
    current: () => (wanted === null ? null : (kept.get(wanted) ?? null)),
  };
}
