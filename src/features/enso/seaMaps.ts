/**
 * The sea surface temperature maps behind El Niño and La Niña (#886): their index loaded with the
 * layer, then each month's image as the month shown changes, the last few kept so stepping back
 * and forth costs nothing. While a month's image loads, the one before stays painted, so playing
 * through the months does not flicker; outside the maps (before September 1981) nothing is.
 */

import { loadEnsoSst, mapFile, type EnsoSst } from '../../data/ensoSst';
import { errorMessage } from '../../util/errors';
import { loadImage } from '../../util/loadImage';
import type { Fetch } from '../../util/fetchJson';
import type { PackedMonth } from './ensoMapLayer';

/** How many months' images are kept. */
const KEPT = 36;

export interface SeaMapsContext {
  readonly folder: string;
  readonly fetchJson: Fetch;
  readonly paint: (packed: PackedMonth | null) => void;
  readonly notify: (message: string) => void;
  /** Asks for the feature to be shown again: the index has loaded. */
  readonly refresh: () => void;
}

export interface SeaMaps {
  /** Paints the month (months since January of year 0), or nothing when `on` is false. */
  show(on: boolean, at: number): void;
  /** The maps' index once loaded, for the legend. */
  readonly index: () => EnsoSst | null;
  /** The month's image last asked for, if it has loaded. */
  readonly current: () => PackedMonth | null;
}

export function seaMaps(context: SeaMapsContext): SeaMaps {
  let index: EnsoSst | null = null;
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

  function fetchMonth(maps: EnsoSst, file: string): void {
    if (loading.has(file)) return;
    loading.add(file);
    loadImage(`${context.folder}${file}`).then(
      (image) => {
        loading.delete(file);
        const packed = { image, bound: maps.bound };
        keep(file, packed);
        if (wanted === file) context.paint(packed);
      },
      (error: unknown) => {
        loading.delete(file);
        context.notify(`Could not load the sea temperature map: ${errorMessage(error)}`);
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
          loadEnsoSst(`${context.folder}index.json`, context.fetchJson).then(
            (loaded) => {
              index = loaded;
              context.refresh();
            },
            (error: unknown) => {
              asked = false;
              context.notify(`Could not load the sea temperature maps: ${errorMessage(error)}`);
            },
          );
        }
        return;
      }
      wanted = mapFile(index, at);
      if (wanted === null) {
        context.paint(null);
        return;
      }
      const packed = kept.get(wanted);
      if (packed === undefined) fetchMonth(index, wanted);
      else context.paint(packed);
    },
    index: () => index,
    current: () => (wanted === null ? null : (kept.get(wanted) ?? null)),
  };
}
