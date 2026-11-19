/**
 * The rain and temperature composites of El Niño and La Niña (#891, #892): their index loaded
 * with the layer, so the picker can list them, then each map's image when it is picked, kept once
 * loaded (there are only sixteen). They do not change with the month shown.
 */

import {
  compositeColours,
  compositeFor,
  loadEnsoComposites,
  type CompositeMap,
  type CompositePick,
  type EnsoComposites,
} from '../../data/ensoComposites';
import { errorMessage } from '../../util/errors';
import type { Fetch } from '../../util/fetchJson';
import { loadImage } from '../../util/loadImage';
import type { PackedMonth } from './ensoMapLayer';

export interface CompositeMapsContext {
  readonly folder: string;
  readonly fetchJson: Fetch;
  readonly paint: (packed: PackedMonth | null) => void;
  readonly notify: (message: string) => void;
  /** Asks for the feature to be shown again: the index has loaded. */
  readonly refresh: () => void;
}

export interface CompositeMaps {
  /** Loads the index, once, if it is not loaded. */
  load(): void;
  /** Paints the picked map by the index, or forgets what was wanted for null. */
  show(pick: CompositePick | null, index: string): void;
  /** The composites' index once loaded. */
  readonly index: () => EnsoComposites | null;
  /** A map's image if loaded; else it is loaded, without painting, and `refresh` asked. */
  image(map: CompositeMap): PackedMonth | null;
}

export function compositeMaps(context: CompositeMapsContext): CompositeMaps {
  let index: EnsoComposites | null = null;
  let asked = false;
  const kept = new Map<string, PackedMonth>();
  const loading = new Set<string>();
  let wanted: string | null = null;

  function fetchMap(file: string, packed: Omit<PackedMonth, 'image'>, quiet = false): void {
    if (loading.has(file)) return;
    loading.add(file);
    loadImage(`${context.folder}${file}`).then(
      (image) => {
        loading.delete(file);
        const loaded = { ...packed, image };
        kept.set(file, loaded);
        if (wanted === file) context.paint(loaded);
        if (quiet) context.refresh();
      },
      (error: unknown) => {
        loading.delete(file);
        context.notify(`Could not load the El Niño map: ${errorMessage(error)}`);
      },
    );
  }

  /** How a map is coloured, from its variable's bound and scale. */
  function describe(map: CompositeMap): Omit<PackedMonth, 'image'> {
    const bound = index?.variables.find(({ id }) => id === map.variable)?.bound ?? 1;
    return {
      bound,
      colours: (bytes, scaled) => compositeColours(bytes, scaled, map.variable),
    };
  }

  return {
    load() {
      if (index !== null || asked) return;
      asked = true;
      loadEnsoComposites(`${context.folder}index.json`, context.fetchJson).then(
        (loaded) => {
          index = loaded;
          context.refresh();
        },
        (error: unknown) => {
          asked = false;
          context.notify(
            `Could not load the El Niño rain and temperature maps: ${errorMessage(error)}`,
          );
        },
      );
    },
    show(pick, by) {
      const map = pick === null || index === null ? null : compositeFor(index, pick, by);
      if (map === null) {
        wanted = null;
        return;
      }
      wanted = map.file;
      const packed = kept.get(map.file);
      if (packed !== undefined) {
        context.paint(packed);
        return;
      }
      context.paint(null);
      fetchMap(map.file, describe(map));
    },
    image(map) {
      const packed = kept.get(map.file);
      if (packed === undefined) fetchMap(map.file, describe(map), true);
      return packed ?? null;
    },
    index: () => index,
  };
}
