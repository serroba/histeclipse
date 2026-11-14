/**
 * The ozone layer (#722) on the feature contract (#380): in the years, the Antarctic ozone hole
 * each spring since 1979 as a cap of its mean area round the South Pole, and beside the globe
 * the hole's area and the ozone-depleting gases since, the year shown marked. Loaded with the
 * layer; a year the record lacks is said, not drawn.
 */

import { holeIn, loadOzone, ozoneText, type OzoneHistory } from '../../data/ozone';
import { errorMessage } from '../../util/errors';
import type { Feature } from '../feature';
import { ozoneCharts } from './chartModel';
import { ozoneLayer } from './ozoneLayer';
import { ozonePanel } from './ozonePanel';

export const ozoneFeature: Feature = {
  id: 'ozone',
  // On or off with its layer, on Earth's globe, in the years.
  watches: (state) => [state.layers, state.mode, state.ma, state.focus],
  mount(context) {
    const cap = context.globe.addLayer(ozoneLayer);
    const panel = context.globe.addLayer(ozonePanel);
    let history: OzoneHistory | null = null;
    let loading = false;
    let said: string | null = null;
    // What was last shown, so the moments of one year (many a second as time plays) cost nothing.
    let shownFor = '';

    function load(): void {
      if (loading) return;
      loading = true;
      loadOzone(`${context.base}data/ozone/history.json`, context.fetchJson).then(
        (loaded) => {
          history = loaded;
          context.refresh();
        },
        (error: unknown) => {
          loading = false;
          shownFor = '';
          context.notify(`Could not load the ozone record: ${errorMessage(error)}`);
        },
      );
    }

    return {
      show(state) {
        const on =
          state.layers.has('ozone') &&
          state.mode === 'globe' &&
          state.ma === null &&
          state.focus === 'earth';
        const year = state.time.date.year;
        const key = `${String(on)}:${String(history !== null)}:${String(year)}`;
        if (key === shownFor) return;
        shownFor = key;
        if (!on) {
          said = null;
          cap.update(null);
          panel.update(null);
          return;
        }
        if (history === null) {
          said = 'Loading the ozone record…';
          load();
          return;
        }
        const found = holeIn(history, year);
        cap.update(found.kind === 'hole' ? found.hole.areaMkm2 : null);
        said = ozoneText(history, year);
        panel.update({ charts: ozoneCharts(history, year), text: said });
      },
      said: () => said,
    };
  },
};
