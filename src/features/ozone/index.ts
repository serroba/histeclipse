/**
 * The ozone layer (#722) on the feature contract (#380): in the years, the Antarctic ozone hole
 * each spring since 1979 as a cap of its mean area round the South Pole, and beside the globe
 * the hole's area and the ozone-depleting gases since, the year shown marked. Where the MSR-2
 * reanalysis has the year (1970 on), the globe shows instead that October's ozone over the whole
 * Earth, the hole in its own shape, each year's map fetched when first shown. Loaded with the
 * layer; a year the record lacks is said, not drawn. A load that fails is said on its chip, and
 * tried again only when the reader asks (#751), not at every moment while time plays.
 */

import {
  holeIn,
  loadOzone,
  ozoneLine,
  ozoneText,
  ozoneWords,
  type OzoneHistory,
} from '../../data/ozone';
import { loadOzoneMaps, mapOf, mapText, omittedText, type OzoneMaps } from '../../data/ozoneMaps';
import { errorMessage } from '../../util/errors';
import type { Feature } from '../feature';
import { ozoneCharts } from './chartModel';
import { ozoneImages } from './ozoneImages';
import { ozoneLayer, type OzoneDrawn, type OzoneMapImage } from './ozoneLayer';
import { ozonePanel, type OzoneView } from './ozonePanel';

/** What a year shows: on the globe its October's map, else the hole's cap; and in words. */
function yearShown(
  history: OzoneHistory,
  maps: OzoneMaps,
  map: OzoneMapImage | null,
  year: number,
): { drawn: OzoneDrawn; said: string; view: OzoneView } {
  const found = holeIn(history, year);
  const october = map === null ? null : mapOf(maps, year);
  const capped = found.kind === 'hole' ? { capMkm2: found.hole.areaMkm2 } : null;
  return {
    drawn: map === null ? capped : { map },
    said:
      october === null
        ? [ozoneText(history, year), omittedText(maps, year)].filter(Boolean).join(' ')
        : `${mapText(maps, october)} ${ozoneWords(history, year)}`,
    view: {
      charts: ozoneCharts(history, year),
      text: ozoneLine(history, year),
      map: october === null ? null : `Globe: ozone in October ${String(year)}, Dobson units.`,
    },
  };
}

export const ozoneFeature: Feature = {
  id: 'ozone',
  // On or off with its layer, on Earth's globe, in the years.
  watches: (state) => [state.layers, state.mode, state.ma, state.focus],
  mount(context) {
    const cap = context.globe.addLayer(ozoneLayer);
    const panel = context.globe.addLayer(ozonePanel);
    let history: OzoneHistory | null = null;
    let maps: OzoneMaps | null = null;
    const mapImage = ozoneImages(context.base, () => {
      shownFor = '';
      context.refresh();
    });
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
      Promise.all([
        loadOzone(`${context.base}data/ozone/history.json`, context.fetchJson),
        loadOzoneMaps(`${context.base}data/ozone/maps.json`, context.fetchJson),
      ]).then(
        ([loaded, index]) => {
          history = loaded;
          maps = index;
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
        if (history === null || maps === null) {
          if (failed) {
            said = 'Could not load the ozone record.';
            return;
          }
          said = 'Loading the ozone record…';
          load();
          return;
        }
        const shown = yearShown(history, maps, mapImage(maps, year), year);
        cap.update(shown.drawn);
        said = shown.said;
        panel.update(shown.view);
      },
      said: () => said,
      load: () => {
        if (!on || history !== null) return null;
        return failed ? { state: 'failed', retry } : { state: 'loading' };
      },
    };
  },
};
