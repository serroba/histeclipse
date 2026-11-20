/**
 * Ways of life as a feature (#380, #909): in historical time with the layer on, the regions by
 * their most widespread way of life, and its key. The file loads the first time the layer is
 * turned on.
 */

import { waysLayer } from '../../globe/historyPaintLayers';
import { type ViewState } from '../../state/viewState';
import { astronomicalYear, formatYear } from '../../time/year';
import {
  loadWaysOfLife,
  waysAt,
  waysNote,
  type WaysAt,
  type WaysOfLife,
} from '../../data/waysOfLife';
import { errorMessage } from '../../util/errors';
import { feature } from '../feature';
import { waysFact } from './here';

const words = (year: number): string => formatYear(astronomicalYear(year));

export const waysFeature = feature({
  id: 'ways',
  needs: ['waysKey'],
  watches: (state) => [state.layers, state.ma],
  mount(context) {
    const { base, fetchJson } = context;
    const waysOnGlobe = context.globe.addLayer(waysLayer);
    let waysOfLife: WaysOfLife | null = null;
    let waysLoading: Promise<WaysOfLife> | null = null;
    let waysSaid: string | null = null;
    // The year last worked out, and the moment rated nearest it: working it out is slow.
    let worked: { readonly year: number; readonly at: WaysAt } | null = null;
    let waysShownYear: number | null = null;

    /** The moment rated nearest a year, worked out once a year. */
    function atYear(data: WaysOfLife, year: number): WaysAt {
      if (worked?.year !== year) worked = { year, at: waysAt(data, year) };
      return worked.at;
    }

    /** In historical time with the layer on, the regions by their most widespread way of life. */
    function showWays(state: ViewState): void {
      const on = state.layers.has('ways') && state.ma === null;
      if (!on) {
        waysSaid = null;
        waysShownYear = null;
        waysOnGlobe.update(null);
        context.waysKey.render(null);
        return;
      }
      if (waysOfLife === null) {
        waysSaid = 'Loading the ways of life…';
        if (waysLoading === null) {
          waysLoading = loadWaysOfLife(`${base}data/ways-of-life.json`, fetchJson);
          waysLoading.then(
            (data) => {
              waysOfLife = data;
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
      const at = atYear(waysOfLife, state.time.date.year);
      waysSaid = waysNote(at, words);
      context.waysKey.render(at);
      // Repainting the map is slow: only when the moment rated changes, as the years go by.
      if (at.year === waysShownYear) return;
      waysShownYear = at.year;
      waysOnGlobe.update(at.regions);
    }

    return {
      show: showWays,
      said: () => waysSaid,
      here(state) {
        if (state.location === null || state.ma !== null) return null;
        if (!state.layers.has('ways') || waysOfLife === null) return null;
        const at = atYear(waysOfLife, state.time.date.year);
        return waysFact(at, state.location, words(at.year));
      },
    };
  },
});
