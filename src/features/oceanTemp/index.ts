/**
 * Ocean temperature (#590) on the feature contract (#380): in the years, the ocean's temperature
 * at the surface, 100 m or 700 m each month since 1940, painted over the sea, with the depth to
 * pick and its scale beside the globe. Loaded with the layer; a month at a time as the moment
 * moves, the next few fetched ahead.
 */

import {
  depthFile,
  depthName,
  loadOceanTemperature,
  oceanText,
  type OceanTemperature,
} from '../../data/oceanTemperature';
import { HISTORY_PAINT_ORDER } from '../../globe/layerHost';
import { monthlyMaps } from '../../globe/monthlyMaps';
import { packedMapLayer } from '../../globe/packedMaps';
import type { ViewState } from '../../state/viewState';
import { feature } from '../feature';
import { oceanTempPanel } from './oceanTempPanel';

/** The depth shown first: 100 m, where El Niño shows best. */
const FIRST_DEPTH = '100m';

/** Whether the layer shows: on, on Earth's globe, in the years. */
function shownOn(state: ViewState): boolean {
  return (
    state.layers.has('oceanTemp') &&
    state.mode === 'globe' &&
    state.ma === null &&
    state.focus === 'earth'
  );
}

/** Months since January of year 0. */
const monthOf = (state: ViewState): number => state.time.date.year * 12 + state.time.date.month - 1;

export const oceanTempFeature = feature({
  id: 'oceanTemp',
  needs: [],
  watches: (state) => [state.layers, state.mode, state.ma, state.focus],
  mount(context) {
    let depth = FIRST_DEPTH;
    let shownFor = '';
    let said: string | null = null;
    const again = (): void => {
      shownFor = '';
      context.refresh();
    };
    const painted = context.globe.addLayer(
      packedMapLayer(HISTORY_PAINT_ORDER.oceanTemp, 'oceanTemp'),
    );
    const panel = context.globe.addLayer(
      oceanTempPanel((picked) => {
        depth = picked;
        again();
      }),
    );
    const boundOf = (maps: OceanTemperature): number =>
      maps.depths.find(({ id }) => id === depth)?.bound ?? 1;
    const maps = monthlyMaps<OceanTemperature>({
      folder: `${context.base}data/ocean-temperature/`,
      load: () =>
        loadOceanTemperature(`${context.base}data/ocean-temperature/index.json`, context.fetchJson),
      file: (index, at) => depthFile(index, depth, at),
      look: (index) => ({ bound: boundOf(index) }),
      names: { map: 'the ocean temperature map', maps: 'the ocean temperature maps' },
      paint: (packed) => {
        painted.update(packed);
      },
      notify: (message) => {
        context.notify(message);
      },
      refresh: again,
    });

    return {
      show(state) {
        const on = shownOn(state);
        const at = monthOf(state);
        const key = `${String(on)}:${String(maps.index() !== null)}:${depth}:${String(at)}`;
        if (key === shownFor) return;
        shownFor = key;
        maps.show(on, at);
        if (!on) {
          said = null;
          panel.update(null);
          return;
        }
        const index = maps.index();
        const chosen = index?.depths.find(({ id }) => id === depth) ?? index?.depths[0];
        if (index === null || chosen === undefined) {
          said = 'Loading the ocean temperature maps…';
          panel.update(null);
          return;
        }
        said = oceanText(index, chosen, at);
        panel.update({
          depths: index.depths.map((each) => ({ id: each.id, name: depthName(each) })),
          depth: chosen.id,
          ends: `−${String(chosen.bound)} · 0 · +${String(chosen.bound)} °C`,
          text: said,
        });
      },
      said: () => said,
    };
  },
});
