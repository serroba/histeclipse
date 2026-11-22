/**
 * The equatorial Pacific from below (#895): each month's section, 2°S–2°N from 120°E to 80°W and
 * down to 400 m, from the ocean temperature maps (`ocean-temperature/section/`, #590), a month
 * at a time as the moment moves (`globe/monthlyMaps`), for the El Niño panel to draw.
 */

import {
  loadOceanTemperature,
  sectionFile,
  shownMonth,
  type OceanTemperature,
} from '../../data/oceanTemperature';
import { monthlyMaps } from '../../globe/monthlyMaps';
import { loadOnce } from '../../state/loadOnce';
import type { PackedMonth } from '../../globe/packedMaps';
import type { Fetch } from '../../util/fetchJson';

/** What the panel draws: the month's section, its depths, and the month it is of. */
export interface SectionView {
  readonly packed: PackedMonth;
  /** The depth of each row, metres, the surface first. */
  readonly levels: readonly number[];
  /** Months since January of year 0. */
  readonly at: number;
}

export interface SectionMaps {
  /** Loads the month's section, or forgets it when `on` is false. */
  show(on: boolean, at: number): void;
  /** The section to draw for the month, once loaded; null before 1940 or until then. */
  view(at: number): SectionView | null;
}

export function sectionMaps(context: {
  readonly base: string;
  readonly fetchJson: Fetch;
  readonly notify: (message: string) => void;
  /** Asks for the feature to be shown again: an index or a section has loaded. */
  readonly refresh: () => void;
}): SectionMaps {
  const folder = `${context.base}data/ocean-temperature/`;
  let drawn: PackedMonth | null = null;
  const maps = monthlyMaps<OceanTemperature>({
    folder,
    index: loadOnce({
      fetch: () => loadOceanTemperature(`${folder}index.json`, context.fetchJson),
      what: 'the equatorial sections',
      context,
    }),
    file: sectionFile,
    look: (index) => ({ bound: index.section.bound }),
    map: 'the equatorial section',
    paint: (packed) => {
      if (packed === drawn) return;
      drawn = packed;
      context.refresh();
    },
    notify: context.notify,
  });
  return {
    show: (on, at) => {
      maps.show(on, at);
    },
    view(at) {
      const index = maps.index();
      const shown = index === null ? null : shownMonth(index, at);
      if (index === null || shown === null || drawn === null) return null;
      return { packed: drawn, levels: index.section.levels, at: shown };
    },
  };
}
