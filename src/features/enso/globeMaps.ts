/**
 * What the El Niño and La Niña layer paints on the globe (#886, #891, #892): the sea this month
 * (OISST), or, picked instead, what El Niño or La Niña usually does to rain or temperature by
 * either index. One painter at a time: the sea gives way first, then the composite paints. Says
 * what is shown, and what there is to pick, for the panel.
 */

import { monthName } from '../../data/enso';
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
import { compositeMaps, type CompositeMaps } from './compositeMaps';
import type { PackedMonth } from '../../globe/packedMaps';
import type { MapChoice } from './ensoPanel';
import { pixelsOf } from './pixels';
import { seaMaps, type SeaMaps } from './seaMaps';

/** The first month OISST's maps hold, September 1981: ERSST's before (#894). */
const OISST_FROM = 1981 * 12 + 8;

/** The globe's first map: the sea this month. */
const SEA = 'sea';

const keyOf = (pick: CompositePick): string => `${pick.variable}-${pick.phase}-${pick.season}`;

const ends = (bound: number, units: string): string =>
  `−${String(bound)} · 0 · +${String(bound)} ${units}`;

/** What the panel offers and shows of the globe's map. */
function choiceOf(
  composites: EnsoComposites | null,
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
    // The indices the composites were made by (NOAA's), whatever the years shown.
    indices:
      chosen === null || composites === null
        ? []
        : [...new Set(composites.maps.map(({ index }) => index))].map((id) => ({
            id,
            name: id.toUpperCase(),
          })),
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
  view(at: number): { readonly sea: string; readonly map: MapChoice };
  /**
   * For "Why here?" (#893): the sea at the place in the month, if shown and at sea, and what El
   * Niño and La Niña usually bring there in the season; null if nothing is known yet.
   */
  here(place: GeoPoint, at: number): string | null;
}

/** What El Niño and La Niña usually bring to a node in the month's season, once all is loaded. */
function usualHere(
  composites: CompositeMaps,
  listed: EnsoComposites,
  offset: number,
  at: number,
): string | null {
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

export function globeMaps(context: GlobeMapsContext): GlobeMaps {
  // What the globe shows: the sea this month (null), or a composite by an index.
  let chosen: CompositePick | null = null;
  let by = 'roni';
  const shared = {
    fetchJson: context.fetchJson,
    paint: context.paint,
    notify: context.notify,
    refresh: context.refresh,
  };
  // The sea from OISST from September 1981, from ERSST before (#894): one painter at a time.
  const oisst = seaMaps({ ...shared, folder: `${context.base}data/enso-sst/` });
  const ersst = seaMaps({ ...shared, folder: `${context.base}data/enso-ersst/` });
  const seaFor = (at: number): SeaMaps => (at < OISST_FROM ? ersst : oisst);
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
      const sea = seaFor(at);
      (sea === oisst ? ersst : oisst).show(false, at);
      sea.show(on && chosen === null, at);
      if (on) composites.load();
      composites.show(on ? chosen : null, by);
    },
    here(place, at) {
      const offset = nodeOffset(place.latitude, place.longitude);
      const sea = seaFor(at);
      const month = sea.current();
      const seaPixels = month === null ? null : pixelsOf(month.image);
      const seaIndex = sea.index();
      const seaSaid =
        seaPixels === null || seaIndex === null || month === null
          ? null
          : seaHereText(
              seaIndex,
              readingAt(
                seaPixels,
                nodeOffset(place.latitude, place.longitude, month.image.width),
                month.bound,
              ).value,
              monthName(at),
            );
      composites.load();
      const listed = composites.index();
      const usual = listed === null ? null : usualHere(composites, listed, offset, at);
      const parts = [seaSaid, usual].filter((part): part is string => part !== null);
      return parts.length === 0 ? null : parts.join(' ');
    },
    view(at) {
      const sea = seaFor(at);
      const listed = composites.index();
      const map = chosen === null || listed === null ? null : compositeFor(listed, chosen, by);
      return {
        sea:
          map === null || listed === null
            ? seaText(sea.index(), at)
            : `On the globe: ${compositeText(listed, map, (id) => id.toUpperCase())}`,
        map: choiceOf(listed, chosen, by, sea.index()?.bound ?? null),
      };
    },
  };
}
