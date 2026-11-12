/**
 * Ways of life as a part of the page (#446): in historical time with the layer on, the regions
 * by their most widespread way of life, and its key. The file loads the first time the layer is
 * turned on.
 */

import type { Globe } from '../../globe/scene';
import type { PartContext } from '../part';
import type { WaysLegend } from '../../ui/waysLegend';
import { waysLayer } from '../../globe/historyPaintLayers';
import { type ViewState } from '../../state/viewState';
import { astronomicalYear, formatYear } from '../../time/year';
import { loadWaysOfLife, waysAt, waysNote, type WaysOfLife } from '../../data/waysOfLife';
import { errorMessage } from '../../util/errors';

/** What it asks of the rest of the page. */
export interface WaysContext extends PartContext {
  readonly globe: Pick<Globe, 'addLayer'>;
  /** Whether the reader is travelling through the years: today's maps rest then. */
  travelling(): boolean;
  /** Say it again in the Layers panel: what it says has changed. */
  refresh(): void;
  /** The key under the years. */
  readonly legend: Pick<WaysLegend, 'render'>;
}

export interface WaysPart {
  readonly show: (state: ViewState) => void;
  /** What the Layers panel says under the layer, if anything. */
  readonly said: () => string | null;
  /** The ways of life, once loaded. */
  readonly data: () => WaysOfLife | null;
}

export function mountWays(context: WaysContext): WaysPart {
  const { base, fetchJson, store } = context;
  const waysOnGlobe = context.globe.addLayer(waysLayer);
  // Ways of life: their file loads the first time the layer is turned on.
  let waysOfLife: WaysOfLife | null = null;
  let waysLoading: Promise<WaysOfLife> | null = null;
  let waysSaid: string | null = null;

  /** In historical time with the layer on, the regions by their most widespread way of life. */
  function showWays(state: ViewState): void {
    const on = state.layers.has('ways') && state.ma === null;
    if (!on) {
      waysSaid = null;
      waysShownYear = null;
      waysOnGlobe.update(null);
      context.legend.render(null);
      return;
    }
    if (waysOfLife === null) {
      waysSaid = 'Loading the ways of life…';
      if (waysLoading === null) {
        waysLoading = loadWaysOfLife(`${base}data/ways-of-life.json`, fetchJson);
        waysLoading.then(
          (data) => {
            waysOfLife = data;
            showWays(store.get());
            context.refresh();
          },
          (error: unknown) => {
            waysLoading = null;
            context.notify(`Could not load the ways of life: ${errorMessage(error)}`);
          },
        );
      }
      return;
    }
    const at = waysAt(waysOfLife, state.time.date.year);
    waysSaid = waysNote(at, (year) => formatYear(astronomicalYear(year)));
    context.legend.render(at);
    // Repainting the map is slow: only when the moment rated changes, as the years go by.
    if (at.year === waysShownYear) return;
    waysShownYear = at.year;
    waysOnGlobe.update(at.regions);
  }
  let waysShownYear: number | null = null;

  return {
    show: showWays,
    said: () => waysSaid,
    data: () => waysOfLife,
  };
}
