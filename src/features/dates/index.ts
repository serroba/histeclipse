/**
 * Archaeological radiocarbon dates (p3k14c) as a feature (#380, #909): in historical time with
 * the layer on, the squares with dates, and the place's, if picked, with a way to see how a date
 * there was found. The counts load with the layer, a place's tile when it is picked.
 */

import { feature, RESTING, type FeatureContext, type LayerAction } from '../feature';
import type { Fetch } from '../../util/fetchJson';
import { dateCellsLayer } from '../../globe/historyPaintLayers';
import {
  datesHere,
  datesNear,
  datesNote,
  loadDatesHeat,
  loadDatesTile,
  tileKeyOf,
  type DatesHeat,
  type DatesNear,
  type DatesTile,
} from '../../data/radiocarbonDates';
import { type GeoPoint, type ViewState } from '../../state/viewState';
import { errorMessage } from '../../util/errors';
import { carried } from './carried';

/** What the dates near a place and a year say, once the place's tile is in. */
interface Found {
  readonly place: GeoPoint;
  readonly year: number;
  readonly said: string;
  readonly action: LayerAction | null;
}

type DatesContext = FeatureContext<'radiocarbon' | 'datingCard'>;

/** A place's tile of dates, fetched once a tile; a place with no dates nearby has none. */
function tilesFrom(
  base: string,
  fetchJson: Fetch,
): (heat: DatesHeat, place: GeoPoint) => Promise<DatesTile | null> {
  const tiles = new Map<string, Promise<DatesTile | null>>();
  return (heat, place) => {
    const key = tileKeyOf(heat, place);
    let tile = tiles.get(key);
    if (tile === undefined) {
      // No tile: none to fetch, nothing to say.
      tile = loadDatesTile(`${base}data/radiocarbon-dates/tiles/${key}.json`, fetchJson).catch(
        () => null,
      );
      tiles.set(key, tile);
    }
    return tile;
  };
}

/** What the place's dates say for the year, and the step to how one of them was found. */
function foundHere(
  heat: DatesHeat,
  tile: DatesTile | null,
  place: GeoPoint,
  year: number,
  near: DatesNear,
  context: DatesContext,
): Found {
  const here = tile === null ? { samples: [], sites: [] } : datesHere(heat, tile, place, year);
  // The date nearest the middle of the step, to carry across the curve.
  const middle = here.samples[Math.floor(here.samples.length / 2)];
  return {
    place,
    year,
    said: datesNote(near, here),
    action:
      middle === undefined
        ? null
        : {
            label: 'How was a date here found?',
            run: () => {
              void context.radiocarbon.curves().then((curves) => {
                const { curve, name, note } = carried(middle, place.latitude < 0);
                context.datingCard.open(curves.curves[curve], name, middle.age, middle.error, note);
              });
            },
          },
  };
}

export const datesFeature = feature({
  id: 'dates',
  needs: ['timeline', 'radiocarbon', 'datingCard'],
  watches: (state) => [state.layers, state.ma, state.location],
  mount(context) {
    const { base, fetchJson } = context;
    const datesOnGlobe = context.globe.addLayer(dateCellsLayer);
    let datesHeat: DatesHeat | null = null;
    let datesHeatLoading: Promise<DatesHeat> | null = null;
    const datesTile = tilesFrom(base, fetchJson);
    let datesSaid: string | null = null;
    let datesAction: LayerAction | null = null;
    // The view last shown: a tile that arrives late is for it, or for nothing.
    let latest: ViewState | null = null;
    // The year whose squares are on the globe: painting them is slow.
    let near: { readonly year: number; readonly at: DatesNear | null } | null = null;
    let found: Found | null = null;

    /** In historical time with the layer on: the squares with dates, and the place's, if picked. */
    function showDates(state: ViewState): void {
      latest = state;
      const on = state.layers.has('dates') && state.ma === null;
      datesAction = null;
      if (!on || context.timeline.travelling()) {
        datesSaid = on ? RESTING : null;
        near = null;
        datesOnGlobe.update(null);
        return;
      }
      if (datesHeat === null) {
        datesSaid = 'Loading the radiocarbon dates…';
        if (datesHeatLoading === null) {
          datesHeatLoading = loadDatesHeat(`${base}data/radiocarbon-dates/heat.json`, fetchJson);
          datesHeatLoading.then(
            (loaded) => {
              datesHeat = loaded;
              context.refresh();
            },
            (error: unknown) => {
              datesHeatLoading = null;
              context.notify(`Could not load the radiocarbon dates: ${errorMessage(error)}`);
            },
          );
        }
        return;
      }
      const heat = datesHeat;
      const year = state.time.date.year;
      if (near?.year !== year) {
        near = { year, at: datesNear(heat, year) };
        datesOnGlobe.update(
          near.at === null ? null : { cells: near.at.cells, cellDegrees: heat.cellDegrees },
        );
      }
      const nearNow = near.at;
      datesSaid = datesNote(nearNow, null);
      const place = state.location;
      if (place === null || nearNow === null) return;
      // The place's dates already found for this year: said again, not asked for again.
      if (found?.place === place && found.year === year) {
        datesSaid = found.said;
        datesAction = found.action;
        return;
      }
      void datesTile(heat, place).then((tile) => {
        // Only if the view still shows this place and year, and has not been answered yet.
        if (
          latest?.location !== place ||
          latest.time.date.year !== year ||
          !latest.layers.has('dates') ||
          (found?.place === place && found.year === year)
        ) {
          return;
        }
        found = foundHere(heat, tile, place, year, nearNow, context);
        context.refresh();
      });
    }

    return {
      show: showDates,
      said: () => datesSaid,
      action: () => datesAction,
    };
  },
});
