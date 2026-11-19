/**
 * The sea surface temperature maps behind El Niño and La Niña (#886), a month each
 * (`globe/monthlyMaps`): OISST's from September 1981, or ERSST's before (#894).
 */

import { loadEnsoSst, mapFile, type EnsoSst } from '../../data/ensoSst';
import type { Fetch } from '../../util/fetchJson';
import { monthlyMaps, type MonthlyMaps } from '../../globe/monthlyMaps';
import type { PackedMonth } from '../../globe/packedMaps';

export interface SeaMapsContext {
  readonly folder: string;
  readonly fetchJson: Fetch;
  readonly paint: (packed: PackedMonth | null) => void;
  readonly notify: (message: string) => void;
  /** Asks for the feature to be shown again: the index has loaded. */
  readonly refresh: () => void;
}

export type SeaMaps = MonthlyMaps<EnsoSst>;

export function seaMaps(context: SeaMapsContext): SeaMaps {
  return monthlyMaps({
    ...context,
    load: () => loadEnsoSst(`${context.folder}index.json`, context.fetchJson),
    file: mapFile,
    look: (maps) => ({ bound: maps.bound }),
    names: { map: 'the sea temperature map', maps: 'the sea temperature maps' },
  });
}
