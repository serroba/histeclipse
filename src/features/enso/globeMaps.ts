/**
 * What the El Niño and La Niña layer paints on the globe (#886, #891, #892): the sea this month
 * (OISST), or, picked instead, what El Niño or La Niña usually does to rain or temperature by
 * either index. One painter at a time: the sea gives way first, then the composite paints. Says
 * what is shown, and what there is to pick, for the panel.
 */

import { monthName, type Enso } from '../../data/enso';
import {
  compositeFor,
  compositeText,
  hereText,
  nodeOffset,
  pickOptions,
  readingAt,
  seasonOf,
  type HereReading,
  type CompositePick,
  type EnsoComposites,
} from '../../data/ensoComposites';
import { seaHereText, seaText } from '../../data/ensoSst';
import type { GeoPoint } from '../../state/viewState';
import type { Fetch } from '../../util/fetchJson';
import { compositeMaps } from './compositeMaps';
import type { PackedMonth } from './ensoMapLayer';
import type { MapChoice } from './ensoPanel';
import { pixelsOf } from './pixels';
import { seaMaps } from './seaMaps';

/** The globe's first map: the sea this month. */
const SEA = 'sea';

const keyOf = (pick: CompositePick): string => `${pick.variable}-${pick.phase}-${pick.season}`;

const ends = (bound: number, units: string): string =>
  `−${String(bound)} · 0 · +${String(bound)} ${units}`;

/** What the panel offers and shows of the globe's map. */
function choiceOf(
  composites: EnsoComposites | null,
  enso: Enso,
  chosen: CompositePick | null,
  by: string,
  seaBound: number | null,
): MapChoice {
  const variable = composites?.variables.find(({ id }) => id === chosen?.variable);
  const listed = composites === null ? [] : pickOptions(composites);
  return {
    options: [
      { value: SEA, label: 'The sea this month' },
      ...listed.map(({ pick, label }) => ({ value: keyOf(pick), label })),
    ],
    chosen: chosen === null ? SEA : keyOf(chosen),
    indices:
      chosen === null
        ? []
        : enso.indices.map((index) => ({ id: index.id, name: index.id.toUpperCase() })),
    by,
    scale: variable?.id ?? 'sea',
    ends:
      variable === undefined
        ? seaBound === null
          ? ''
          : ends(seaBound, '°C')
        : ends(variable.bound, variable.units),
  };
}

export interface GlobeMapsContext {
  readonly base: string;
  readonly fetchJson: Fetch;
  readonly paint: (packed: PackedMonth | null) => void;
  readonly notify: (message: string) => void;
  /** Asks for the feature to be shown again: something loaded, or was picked. */
  readonly refresh: () => void;
}

export interface GlobeMaps {
  /** Hears a pick from the panel: a map's value and an index. */
  pick(map: string, index: string): void;
  /** Paints what is picked for the month, or nothing when `on` is false. */
  show(on: boolean, at: number): void;
  /** What the panel says of the globe's map, and offers. */
  view(enso: Enso, at: number): { readonly sea: string; readonly map: MapChoice };
  /**
   * For "Why here?" (#893): the sea at the place in the month, if shown and at sea, and what El
   * Niño and La Niña usually bring there in the season; null if nothing is known yet.
   */
  here(place: GeoPoint, at: number): string | null;
}

export function globeMaps(context: GlobeMapsContext): GlobeMaps {
  /** What El Niño and La Niña usually bring to a node in the month's season, once all is loaded. */
  function usualHere(listed: EnsoComposites, offset: number, at: number): string | null {
    const season = seasonOf((at % 12) + 1);
    const maps = listed.maps.filter((map) => map.season === season);
    const readings: HereReading[] = [];
    for (const map of maps) {
      const packed = composites.image(map);
      const pixels = packed === null ? null : pixelsOf(packed.image);
      if (packed !== null && pixels !== null) {
        readings.push({ ...map, ...readingAt(pixels, offset, packed.bound) });
      }
    }
    if (readings.length < maps.length) return null;
    return hereText(listed, season, readings, (id) => id.toUpperCase());
  }

  // What the globe shows: the sea this month (null), or a composite by an index.
  let chosen: CompositePick | null = null;
  let by = 'roni';
  const shared = {
    fetchJson: context.fetchJson,
    paint: context.paint,
    notify: context.notify,
    refresh: context.refresh,
  };
  const sea = seaMaps({ ...shared, folder: `${context.base}data/enso-sst/` });
  const composites = compositeMaps({ ...shared, folder: `${context.base}data/enso-composites/` });
  return {
    pick(map, index) {
      const listed = composites.index();
      chosen =
        map === SEA || listed === null
          ? null
          : (pickOptions(listed).find(({ pick }) => keyOf(pick) === map)?.pick ?? null);
      by = index === '' ? by : index;
      context.refresh();
    },
    show(on, at) {
      sea.show(on && chosen === null, at);
      if (on) composites.load();
      composites.show(on ? chosen : null, by);
    },
    here(place, at) {
      const offset = nodeOffset(place.latitude, place.longitude);
      const month = sea.current();
      const seaPixels = month === null ? null : pixelsOf(month.image);
      const seaIndex = sea.index();
      const seaSaid =
        seaPixels === null || seaIndex === null || month === null
          ? null
          : seaHereText(seaIndex, readingAt(seaPixels, offset, month.bound).value, monthName(at));
      composites.load();
      const listed = composites.index();
      const usual = listed === null ? null : usualHere(listed, offset, at);
      const parts = [seaSaid, usual].filter((part): part is string => part !== null);
      return parts.length === 0 ? null : parts.join(' ');
    },
    view(enso, at) {
      const listed = composites.index();
      const map = chosen === null || listed === null ? null : compositeFor(listed, chosen, by);
      return {
        sea:
          map === null || listed === null
            ? seaText(sea.index(), at)
            : `On the globe: ${compositeText(listed, map, (id) => id.toUpperCase())}`,
        map: choiceOf(listed, enso, chosen, by, sea.index()?.bound ?? null),
      };
    },
  };
}
