/**
 * Deep time's air as a feature (#380, #444, #909): the gases of the ice cores on the ice ages'
 * span, those of the last 540 million years on that span, and the Paleo-CO2 Data Archive once
 * the reader has asked for it. Each loads the first time it is asked for.
 */

import { loadAtmosphere, type Atmosphere } from '../../data/atmosphere';
import { loadDeepAir, type DeepAir } from '../../data/deepAir';
import { errorMessage } from '../../util/errors';
import { feature } from '../feature';

export const airFeature = feature({
  id: 'air',
  needs: ['co2Archive'],
  watches: (state) => [state.layers, state.ma, state.deepScale],
  mount(context) {
    const { base, fetchJson } = context;
    // The ice-core gases: loaded the first time the layer is turned on.
    let atmosphere: Atmosphere | null = null;
    let atmosphereLoading: Promise<Atmosphere> | null = null;
    // The gases of the last 540 million years: loaded the first time Air is on at that scale.
    let deepAir: DeepAir | null = null;
    let deepAirLoading: Promise<DeepAir> | null = null;

    function loadDeep(): void {
      if (deepAir !== null || deepAirLoading !== null) return;
      deepAirLoading = loadDeepAir(`${base}data/air-deep.json`, fetchJson);
      deepAirLoading.then(
        (loaded) => {
          deepAir = loaded;
          context.refresh();
        },
        (error: unknown) => {
          deepAirLoading = null;
          context.notify(`Could not load the deep-time gases: ${errorMessage(error)}`);
        },
      );
    }

    function loadIceCores(): void {
      if (atmosphere !== null || atmosphereLoading !== null) return;
      atmosphereLoading = loadAtmosphere(`${base}data/atmosphere.json`, fetchJson);
      atmosphereLoading.then(
        (loaded) => {
          atmosphere = loaded;
          context.refresh();
        },
        (error: unknown) => {
          atmosphereLoading = null;
          context.notify(`Could not load the ice-core gases: ${errorMessage(error)}`);
        },
      );
    }

    return {
      deepBar(state) {
        if (state.deepScale === 'eons' || !state.layers.has('air')) return { air: { on: false } };
        if (state.deepScale === 'all') loadDeep();
        else loadIceCores();
        return {
          air: { on: true, atmosphere, deep: deepAir, archive: context.co2Archive.loaded() },
        };
      },
    };
  },
});
