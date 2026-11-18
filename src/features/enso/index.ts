/**
 * El Niño and La Niña (#886) on the feature contract (#380): in the years, NOAA's two indices of
 * the tropical Pacific since 1950 side by side beside the globe, the month shown marked, and what
 * each says of it, none picked over the other; and on the globe, from September 1981, that
 * month's sea surface temperature against its 1991–2020 mean (NOAA OISST). Loaded with the layer.
 */

import { ensoText, loadEnso, monthOf, type Enso } from '../../data/enso';
import { seaText } from '../../data/ensoSst';
import { errorMessage } from '../../util/errors';
import type { Feature } from '../feature';
import { ensoChart } from './chartModel';
import { ensoMapLayer } from './ensoMapLayer';
import { ensoPanel } from './ensoPanel';
import { seaMaps } from './seaMaps';

export const ensoFeature: Feature = {
  id: 'enso',
  watches: (state) => [state.layers, state.mode, state.ma, state.focus],
  mount(context) {
    // What was last shown, so the moments of one month cost nothing.
    let shownFor = '';
    const panel = context.globe.addLayer(ensoPanel);
    const painted = context.globe.addLayer(ensoMapLayer);
    const sea = seaMaps({
      folder: `${context.base}data/enso-sst/`,
      fetchJson: context.fetchJson,
      paint: (packed) => {
        painted.update(packed);
      },
      notify: (message) => {
        context.notify(message);
      },
      refresh: () => {
        shownFor = '';
        context.refresh();
      },
    });
    let enso: Enso | null = null;
    let loading = false;
    let said: string | null = null;

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
        sea.show(on, at);
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
          sea: seaText(sea.index(), at),
        });
      },
      said: () => said,
    };
  },
};
