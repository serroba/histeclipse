/**
 * Ocean temperature (#590) on the feature contract (#380): in the years, the ocean's temperature
 * at the surface, 100 m or 700 m each month since 1940, or at 2,000 to 5,000 m each year (#940),
 * painted over the sea, with the depth to pick and its scale beside the globe. Loaded with the
 * layer; a map at a time as the moment moves, the next few fetched ahead.
 */

import {
  deepFile,
  deepText,
  depthFile,
  depthName,
  loadOceanDeep,
  loadOceanTemperature,
  oceanText,
  type Depth,
  type OceanDeep,
  type OceanTemperature,
} from '../../data/oceanTemperature';
import { HISTORY_PAINT_ORDER } from '../../globe/layerHost';
import { monthlyMaps } from '../../globe/monthlyMaps';
import { packedMapLayer } from '../../globe/packedMaps';
import type { ViewState } from '../../state/viewState';
import { loadOnce, type LoadOnce } from '../../state/loadOnce';
import { feature, type FeatureContext } from '../feature';
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

/** The monthly maps and the deep yearly ones, loaded together. */
interface OceanMaps {
  readonly upper: OceanTemperature;
  readonly deep: OceanDeep;
}

/** Every depth to pick, the monthly ones first. */
const allDepths = (maps: OceanMaps): readonly Depth[] => [
  ...maps.upper.depths,
  ...maps.deep.depths,
];

/** Whether a depth is one of the deep, yearly ones. */
const isDeep = (maps: OceanMaps, id: string): boolean =>
  maps.deep.depths.some((each) => each.id === id);

/** Months since January of year 0. */
const monthOf = (state: ViewState): number => state.time.date.year * 12 + state.time.date.month - 1;

/** The monthly maps' index and the deep ones', fetched together the first time (#762). */
function oceanMapsLoad(
  folder: string,
  context: FeatureContext,
  again: () => void,
): LoadOnce<OceanMaps> {
  return loadOnce<OceanMaps>({
    fetch: async () => {
      const [upper, deep] = await Promise.all([
        loadOceanTemperature(`${folder}index.json`, context.fetchJson),
        loadOceanDeep(`${folder}deep.json`, context.fetchJson),
      ]);
      return { upper, deep };
    },
    what: 'the ocean temperature maps',
    context: {
      notify: (message) => {
        context.notify(message);
      },
      refresh: again,
    },
  });
}

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
    const folder = `${context.base}data/ocean-temperature/`;
    const boundOf = (index: OceanMaps): number =>
      allDepths(index).find(({ id }) => id === depth)?.bound ?? 1;
    const indexLoad = oceanMapsLoad(folder, context, again);
    let on = false;
    const maps = monthlyMaps<OceanMaps>({
      folder,
      index: indexLoad,
      file: (index, at) =>
        isDeep(index, depth) ? deepFile(index.deep, depth, at) : depthFile(index.upper, depth, at),
      look: (index) => ({ bound: boundOf(index) }),
      map: 'the ocean temperature map',
      paint: (packed) => {
        painted.update(packed);
      },
      notify: (message) => {
        context.notify(message);
      },
    });

    return {
      show(state) {
        on = shownOn(state);
        const at = monthOf(state);
        const key = `${String(on)}:${indexLoad.status()}:${depth}:${String(at)}`;
        if (key === shownFor) return;
        shownFor = key;
        maps.show(on, at);
        if (!on) {
          said = null;
          panel.update(null);
          return;
        }
        const index = maps.index();
        const depths = index === null ? [] : allDepths(index);
        const chosen = depths.find(({ id }) => id === depth) ?? depths[0];
        if (index === null || chosen === undefined) {
          said =
            indexLoad.status() === 'failed'
              ? 'Could not load the ocean temperature maps.'
              : 'Loading the ocean temperature maps…';
          panel.update(null);
          return;
        }
        said = isDeep(index, chosen.id)
          ? deepText(index.deep, chosen, at)
          : oceanText(index.upper, chosen, at);
        panel.update({
          depths: depths.map((each) => ({
            id: each.id,
            name: isDeep(index, each.id) ? `${depthName(each)}, yearly` : depthName(each),
          })),
          depth: chosen.id,
          ends: `−${String(chosen.bound)} · 0 · +${String(chosen.bound)} °C`,
          text: said,
        });
      },
      said: () => said,
      load: () => indexLoad.report(on),
    };
  },
});
