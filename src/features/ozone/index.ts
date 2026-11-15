/**
 * The ozone layer (#722) on the feature contract (#380): in the years, the Antarctic ozone hole
 * each spring since 1979 as a cap of its mean area round the South Pole, and beside the globe
 * the hole's area and the ozone-depleting gases since, the year shown marked. Loaded with the
 * layer; a year the record lacks is said, not drawn. A load that fails is said on its chip, and
 * tried again only when the reader asks (#751), not at every moment while time plays.
 */

import { holeIn, loadOzone, ozoneLine, ozoneText, type OzoneHistory } from '../../data/ozone';
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
    let failed = false;
    let on = false;
    let said: string | null = null;
    // What was last shown, so the moments of one year (many a second as time plays) cost nothing.
    let shownFor = '';

    function load(): void {
      if (loading) return;
      loading = true;
      failed = false;
      loadOzone(`${context.base}data/ozone/history.json`, context.fetchJson).then(
        (loaded) => {
          history = loaded;
          loading = false;
          context.refresh();
        },
        (error: unknown) => {
          loading = false;
          failed = true;
          context.notify(`Could not load the ozone record: ${errorMessage(error)}`);
          context.refresh();
        },
      );
    }

    /** Try the load again, as the reader asks from its chip. */
    function retry(): void {
      load();
      context.refresh();
    }

    return {
      show(state) {
        on =
          state.layers.has('ozone') &&
          state.mode === 'globe' &&
          state.ma === null &&
          state.focus === 'earth';
        const year = state.time.date.year;
        const key = `${String(on)}:${String(history !== null)}:${String(failed)}:${String(year)}`;
        if (key === shownFor) return;
        shownFor = key;
        if (!on) {
          said = null;
          cap.update(null);
          panel.update(null);
          return;
        }
        if (history === null) {
          if (failed) {
            said = 'Could not load the ozone record.';
            return;
          }
          said = 'Loading the ozone record…';
          load();
          return;
        }
        const found = holeIn(history, year);
        cap.update(found.kind === 'hole' ? found.hole.areaMkm2 : null);
        said = ozoneText(history, year);
        panel.update({ charts: ozoneCharts(history, year), text: ozoneLine(history, year) });
      },
      said: () => said,
      load: () => {
        if (!on || history !== null) return null;
        return failed ? { state: 'failed', retry } : { state: 'loading' };
      },
    };
  },
};
