/**
 * Ancient genomes (AADR) on the feature contract (#380): their file loads the first time the
 * layer is on; in historical time, the regions with genomes dated near the year, each a count to
 * tap for its card.
 */

import {
  genomeCellCard,
  genomesNear,
  genomesNote,
  loadAncientGenomes,
  type AncientGenomes,
} from '../../data/ancientGenomes';
import { errorMessage } from '../../util/errors';
import { RESTING, type Feature } from '../feature';
import { genomeLayer } from './genomeLayer';

export const genomesFeature: Feature = {
  id: 'genomes',
  picks: 'genome',
  // On or off with its layer, in historical time.
  watches: (state) => [state.layers, state.ma],
  mount(context) {
    const cellsOnGlobe = context.globe.addLayer(genomeLayer);
    let genomes: AncientGenomes | null = null;
    let loading = false;
    let said: string | null = null;
    let year = 0;
    // What was last drawn, so the moments of one year (many a second as time plays) cost nothing.
    let drawnFor = '';

    return {
      show(state) {
        const on = state.layers.has('genomes') && state.ma === null;
        const resting = context.travelling();
        year = state.time.date.year;
        const key = `${String(on)}:${String(resting)}:${String(genomes !== null)}:${String(year)}`;
        if (key === drawnFor) return;
        drawnFor = key;
        if (!on || resting) {
          said = on ? RESTING : null;
          cellsOnGlobe.update(null);
          return;
        }
        if (genomes === null) {
          said = 'Loading the ancient genomes…';
          if (loading) return;
          loading = true;
          loadAncientGenomes(`${context.base}data/genomes/aadr.json`, context.fetchJson).then(
            (loaded) => {
              genomes = loaded;
              context.refresh();
            },
            (error: unknown) => {
              loading = false;
              drawnFor = '';
              context.notify(`Could not load the ancient genomes: ${errorMessage(error)}`);
            },
          );
          return;
        }
        const near = genomesNear(genomes, year);
        said = genomesNote(near);
        cellsOnGlobe.update(near.cells);
      },
      pick(cell) {
        if (genomes === null) return;
        const card = genomeCellCard(genomes, Number(cell), year);
        if (card !== null) context.showCard(card);
      },
      said: () => said,
    };
  },
};
