/**
 * El Niño and La Niña (#886) on the feature contract (#380): in the years, NOAA's two indices of
 * the tropical Pacific since 1950 side by side beside the globe, the month shown marked, and what
 * each says of it, none picked over the other. Loaded with the layer.
 */

import { ensoText, loadEnso, monthOf, type Enso } from '../../data/enso';
import { errorMessage } from '../../util/errors';
import type { Feature } from '../feature';
import { ensoChart } from './chartModel';
import { ensoPanel } from './ensoPanel';

export const ensoFeature: Feature = {
  id: 'enso',
  watches: (state) => [state.layers, state.mode, state.ma, state.focus],
  mount(context) {
    const panel = context.globe.addLayer(ensoPanel);
    let enso: Enso | null = null;
    let loading = false;
    let said: string | null = null;
    // What was last shown, so the moments of one month cost nothing.
    let shownFor = '';

    function load(): void {
      if (loading) return;
      loading = true;
      loadEnso(`${context.base}data/enso/index.json`, context.fetchJson).then(
        (loaded) => {
          enso = loaded;
          context.refresh();
        },
        (error: unknown) => {
          loading = false;
          shownFor = '';
          context.notify(`Could not load the El Niño indices: ${errorMessage(error)}`);
        },
      );
    }

    return {
      show(state) {
        const on =
          state.layers.has('enso') &&
          state.mode === 'globe' &&
          state.ma === null &&
          state.focus === 'earth';
        const at = monthOf(state.time.date.year, state.time.date.month);
        const key = `${String(on)}:${String(enso !== null)}:${String(at)}`;
        if (key === shownFor) return;
        shownFor = key;
        if (!on) {
          said = null;
          panel.update(null);
          return;
        }
        if (enso === null) {
          said = 'Loading the El Niño indices…';
          load();
          return;
        }
        said = ensoText(enso, at);
        panel.update({
          chart: ensoChart(enso, at),
          names: enso.indices.map((index) => ({ id: index.id, name: index.label })),
          text: said,
        });
      },
      said: () => said,
    };
  },
};
