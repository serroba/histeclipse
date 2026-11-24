/**
 * Maps a month each, painted as the month shown changes (#886, #590): their index loaded with
 * the layer, then each month's image, the last few kept so stepping back and forth costs
 * nothing, and the next few fetched ahead (#915). While a month's image loads, the one before
 * stays painted, so playing through the months does not flicker; where there is no map for the
 * month, nothing is.
 */

import type { LoadOnce } from '../state/loadOnce';
import { errorMessage } from '../util/errors';
import { loadImage } from '../util/loadImage';
import type { PackedMonth } from './packedMaps';

/** How many months' images are kept. */
const KEPT = 36;
/** How many months after the one shown are fetched ahead, so playing need not wait for them. */
const AHEAD = 3;

export interface MonthlyMapsContext<Index> {
  readonly folder: string;
  /**
   * The maps' index, fetched the first time the maps are shown: its feature reports its load on
   * the layer's chip (#762), and a failed load waits for Try again there.
   */
  readonly index: Pick<LoadOnce<Index>, 'value' | 'want'>;
  /** A month's file under `folder` (months since January of year 0), or null where none. */
  readonly file: (index: Index, at: number) => string | null;
  /** How a map is drawn: its bound, and its colours if not the sea's. */
  readonly look: (index: Index) => Omit<PackedMonth, 'image'>;
  /** What failed, in words: `the sea temperature map`. */
  readonly map: string;
  readonly paint: (packed: PackedMonth | null) => void;
  readonly notify: (message: string) => void;
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
  const kept = new Map<string, PackedMonth>();
  const loading = new Set<string>();
  let wanted: string | null = null;
  // Whether a map of these is painted. Two sets of maps can share a painter (ERSST's months and
  // OISST's, #894): the one not in use takes nothing away when it is not the one painted, else
  // each month would take the other's map away and paint it again, two repaints of the whole
  // history map for one month (#1045).
  let painting = false;

  function paint(packed: PackedMonth | null): void {
    if (packed === null && !painting) return;
    painting = packed !== null;
    context.paint(packed);
  }

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
        if (wanted === file) paint(packed);
      },
      (error: unknown) => {
        loading.delete(file);
        context.notify(`Could not load ${context.map}: ${errorMessage(error)}`);
      },
    );
  }

  return {
    show(on, at) {
      if (!on) {
        wanted = null;
        paint(null);
        return;
      }
      const index = context.index.value();
      if (index === null) {
        context.index.want();
        return;
      }
      wanted = context.file(index, at);
      if (wanted === null) {
        paint(null);
        return;
      }
      const packed = kept.get(wanted);
      if (packed === undefined) fetchMonth(index, wanted);
      else paint(packed);
      for (let ahead = 1; ahead <= AHEAD; ahead += 1) {
        const next = context.file(index, at + ahead);
        if (next !== null && next !== wanted && !kept.has(next)) fetchMonth(index, next);
      }
    },
    index: () => context.index.value(),
    current: () => (wanted === null ? null : (kept.get(wanted) ?? null)),
  };
}
