/**
 * Ocean currents (#927) on the feature contract (#380): in the years, the month's currents near
 * the surface or at 1,500 m drawn as streaks drifting with the water, as Windy draws the wind:
 * the AMOC's warm water north in the Gulf Stream, and its cold water south along the deep
 * western boundary. The depth to pick beside the globe. Loaded with the layer; a month at a time.
 */

import {
  currentsDepthName,
  currentsFile,
  currentsText,
  loadOceanCurrents,
  type OceanCurrents,
} from '../../data/oceanCurrents';
import { monthlyMaps } from '../../globe/monthlyMaps';
import type { ViewState } from '../../state/viewState';
import { feature } from '../feature';
import { fieldFromImage } from './fieldImage';
import { flowLayer } from './flowLayer';
import { oceanCurrentsPanel } from './oceanCurrentsPanel';

/** The depth shown first: near the surface, the Gulf Stream. */
const FIRST_DEPTH = 'surface';

function shownOn(state: ViewState): boolean {
  return (
    state.layers.has('oceanCurrents') &&
    state.mode === 'globe' &&
    state.ma === null &&
    state.focus === 'earth'
  );
}

const monthOf = (state: ViewState): number => state.time.date.year * 12 + state.time.date.month - 1;

export const oceanCurrentsFeature = feature({
  id: 'oceanCurrents',
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
    const flow = context.globe.addLayer(flowLayer);
    const panel = context.globe.addLayer(
      oceanCurrentsPanel((picked) => {
        depth = picked;
        again();
      }),
    );
    const boundOf = (index: OceanCurrents): number =>
      index.depths.find(({ id }) => id === depth)?.bound ?? 1;
    const maps = monthlyMaps<OceanCurrents>({
      folder: `${context.base}data/ocean-currents/`,
      load: () =>
        loadOceanCurrents(`${context.base}data/ocean-currents/index.json`, context.fetchJson),
      file: (index, at) => currentsFile(index, depth, at),
      look: (index) => ({ bound: boundOf(index) }),
      names: { map: 'the ocean currents map', maps: 'the ocean currents' },
      paint: (packed) => {
        flow.update(packed === null ? null : fieldFromImage(packed.image, packed.bound));
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
          said = 'Loading the ocean currents…';
          panel.update(null);
          return;
        }
        said = currentsText(index, chosen, at);
        panel.update({
          depths: index.depths.map((each) => ({ id: each.id, name: currentsDepthName(each) })),
          depth: chosen.id,
          text: said,
        });
      },
      said: () => said,
    };
  },
});
