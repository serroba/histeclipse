/**
 * Archaeological radiocarbon dates (p3k14c) as a part of the page (#446): in historical time
 * with the layer on, the squares with dates, and the place's, if picked, with a way to see how a
 * date there was found. The counts load with the layer, a place's tile when it is picked.
 */

import type { Globe } from '../../globe/scene';
import type { PartContext } from '../part';
import { RESTING } from '../feature';
import type { DatingCard } from '../../ui/datingCard';
import { dateCellsLayer } from '../../globe/historyPaintLayers';
import { type Radiocarbon } from '../../data/radiocarbon';
import {
  datesHere,
  datesNear,
  datesNote,
  loadDatesHeat,
  loadDatesTile,
  tileKeyOf,
  type DatesHeat,
  type DatesTile,
} from '../../data/radiocarbonDates';
import { type GeoPoint, type ViewState } from '../../state/viewState';
import { errorMessage } from '../../util/errors';

/** What it asks of the rest of the page. */
export interface DatesContext extends PartContext {
  readonly globe: Pick<Globe, 'addLayer'>;
  /** Whether the reader is travelling through the years: today's maps rest then. */
  travelling(): boolean;
  /** Say it again in the Layers panel: what it says has changed. */
  refresh(): void;
  /** The calibration curves, loaded once. */
  radiocarbonCurves(): Promise<Radiocarbon>;
  /** The card that carries a date across a curve. */
  readonly datingCard: Pick<DatingCard, 'open'>;
}

export interface DatesPart {
  readonly show: (state: ViewState) => void;
  /** What the Layers panel says under the layer, if anything. */
  readonly said: () => string | null;
  /** The Layers panel's way to how a date here was found, once the place's tile is in. */
  readonly action: () => { readonly label: string; readonly run: () => void } | null;
}

export function mountDates(context: DatesContext): DatesPart {
  const { base, fetchJson, store } = context;
  const datesOnGlobe = context.globe.addLayer(dateCellsLayer);
  // Archaeological radiocarbon dates (p3k14c): the counts load with the layer, a place's tile
  // when it is picked.
  let datesHeat: DatesHeat | null = null;
  let datesHeatLoading: Promise<DatesHeat> | null = null;
  const datesTiles = new Map<string, Promise<DatesTile | null>>();
  let datesSaid: string | null = null;
  let datesAction: { readonly label: string; readonly run: () => void } | null = null;

  function datesTile(heat: DatesHeat, place: GeoPoint): Promise<DatesTile | null> {
    const key = tileKeyOf(heat, place);
    let tile = datesTiles.get(key);
    if (tile === undefined) {
      // A place with no dates nearby has no tile: none to fetch, nothing to say.
      tile = loadDatesTile(`${base}data/radiocarbon-dates/tiles/${key}.json`, fetchJson).catch(
        () => null,
      );
      datesTiles.set(key, tile);
    }
    return tile;
  }

  /** In historical time with the layer on: the squares with dates, and the place's, if picked. */
  function showDates(state: ViewState): void {
    const on = state.layers.has('dates') && state.ma === null;
    datesAction = null;
    if (!on || context.travelling()) {
      datesSaid = on ? RESTING : null;
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
            showDates(store.get());
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
    const near = datesNear(heat, year);
    datesOnGlobe.update(
      near === null ? null : { cells: near.cells, cellDegrees: heat.cellDegrees },
    );
    datesSaid = datesNote(near, null);
    const place = state.location;
    if (place === null || near === null) return;
    void datesTile(heat, place).then((tile) => {
      const now = store.get();
      // Only if the view still shows this place and year.
      if (now.location !== place || now.time.date.year !== year || !now.layers.has('dates')) return;
      const here = tile === null ? { samples: [], sites: [] } : datesHere(heat, tile, place, year);
      datesSaid = datesNote(near, here);
      // The date nearest the middle of the step, to carry across the curve.
      const middle = here.samples[Math.floor(here.samples.length / 2)];
      datesAction =
        middle === undefined
          ? null
          : {
              label: 'How was a date here found?',
              run: () => {
                void context.radiocarbonCurves().then((curves) => {
                  const south = place.latitude < 0;
                  const what = [middle.material, middle.period].filter((word) => word !== '');
                  context.datingCard.open(
                    south ? curves.curves.shcal20 : curves.curves.intcal20,
                    south ? 'SHCal20' : 'IntCal20',
                    middle.age,
                    middle.error,
                    `${middle.lab || 'A sample'} from ${middle.site || 'an unnamed site'}${middle.country === '' ? '' : `, ${middle.country}`}${what.length === 0 ? '' : ` (${what.join(', ')})`}: ${String(middle.age)} ± ${String(middle.error)} radiocarbon years, from p3k14c.`,
                  );
                });
              },
            };
      context.refresh();
    });
  }

  return {
    show: showDates,
    said: () => datesSaid,
    action: () => datesAction,
  };
}
