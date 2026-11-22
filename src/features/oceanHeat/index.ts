/**
 * Ocean heat (#589) on the feature contract (#380): in the years, where the ocean has gained heat
 * since 1960 or in the Argo years, as one of IAP's three trend maps painted over the sea, with
 * its own legend and the map to pick beside the globe. A trend over its period, so it does not
 * change with the year shown. Loaded with the layer.
 */

import { loadOceanHeat, mapText, type OceanHeat } from '../../data/oceanHeat';
import { errorMessage } from '../../util/errors';
import { loadOnce } from '../../state/loadOnce';
import { feature } from '../feature';
import { loadImage } from '../../util/loadImage';
import { oceanHeatLayer, type PackedMap } from './oceanHeatLayer';
import { oceanHeatPanel } from './oceanHeatPanel';

/** The map shown first: the whole column, over the whole record. */
const FIRST_MAP = '0-2000m-1960-2025';

export const oceanHeatFeature = feature({
  id: 'oceanHeat',
  needs: [],
  watches: (state) => [state.layers, state.mode, state.ma, state.focus],
  mount(context) {
    const painted = context.globe.addLayer(oceanHeatLayer);
    const indexLoad = loadOnce<OceanHeat>({
      fetch: () =>
        loadOceanHeat(`${context.base}data/ocean-heat-map/index.json`, context.fetchJson),
      what: 'the ocean heat maps',
      context,
    });
    let index: OceanHeat | null = null;
    /** How the index's load stood when last shown: shown again when it changes. */
    let shownStatus = indexLoad.status();
    let chosen = FIRST_MAP;
    const packed = new Map<string, PackedMap>();
    const asked = new Set<string>();
    let on = false;
    let said: string | null = null;
    const panel = context.globe.addLayer(
      oceanHeatPanel((id) => {
        chosen = id;
        draw();
      }),
    );

    function loadMap(data: OceanHeat, id: string): void {
      const map = data.maps.find((each) => each.id === id);
      if (map === undefined || asked.has(id)) return;
      asked.add(id);
      loadImage(`${context.base}data/ocean-heat-map/${map.file}`).then(
        (image) => {
          packed.set(id, { image, bound: map.bound });
          draw();
        },
        (error: unknown) => {
          asked.delete(id);
          context.notify(`Could not load the ocean heat map: ${errorMessage(error)}`);
        },
      );
    }

    function draw(): void {
      if (!on || index === null) {
        painted.update(null);
        panel.update(null);
        return;
      }
      const map = index.maps.find((each) => each.id === chosen) ?? index.maps[0];
      if (map === undefined) return;
      chosen = map.id;
      said = mapText(map);
      panel.update({ maps: index.maps, shown: chosen, text: said });
      const image = packed.get(chosen);
      painted.update(image ?? null);
      if (image === undefined) loadMap(index, chosen);
    }

    return {
      show(state) {
        const now =
          state.layers.has('oceanHeat') &&
          state.mode === 'globe' &&
          state.ma === null &&
          state.focus === 'earth';
        const status = indexLoad.status();
        if (now === on && status === shownStatus) return;
        on = now;
        shownStatus = status;
        if (!on) said = null;
        index = indexLoad.value();
        if (on && index === null) {
          indexLoad.want();
          shownStatus = indexLoad.status();
          said =
            shownStatus === 'failed'
              ? 'Could not load the ocean heat maps.'
              : 'Loading the ocean heat maps…';
          return;
        }
        draw();
      },
      said: () => said,
      load: () => indexLoad.report(on),
    };
  },
});
