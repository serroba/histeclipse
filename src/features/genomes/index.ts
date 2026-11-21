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
import { feature, travelPace } from '../feature';
import { genomeLayer } from './genomeLayer';
import './genomes.css';

export const genomesFeature = feature({
  id: 'genomes',
  needs: ['cards', 'timeline'],
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
    // While the years play, drawn a couple of times a second, not every frame (and not rested).
    const pace = travelPace(() => {
      context.refresh();
    });

    return {
      show(state) {
        const on = state.layers.has('genomes') && state.ma === null;
        const travelling = context.timeline.travelling();
        year = state.time.date.year;
        const key = `${String(on)}:${String(travelling)}:${String(genomes !== null)}:${String(year)}`;
        if (key === drawnFor) return;
        if (!on) {
          drawnFor = key;
          said = null;
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
        if (!pace.due(travelling)) return;
        drawnFor = key;
        const near = genomesNear(genomes, year);
        said = genomesNote(near);
        cellsOnGlobe.update(near.cells);
      },
      pick(cell) {
        if (genomes === null) return;
        const card = genomeCellCard(genomes, Number(cell), year);
        if (card !== null) context.cards.show(card);
      },
      said: () => said,
    };
  },
});
