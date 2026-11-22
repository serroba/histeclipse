/**
 * Ancient genomes (AADR) on the feature contract (#380): their file loads the first time the
 * layer is on; in historical time, the regions with genomes dated near the year, each a count to
 * tap for its card.
 */

import {
  cellRows,
  genomeCellCard,
  genomesNear,
  genomesNote,
  loadAncientGenomes,
  type AncientGenomes,
} from '../../data/ancientGenomes';
import { loadOnce } from '../layerLoad';
import { feature, travelPace } from '../feature';
import { genomeLayer } from './genomeLayer';
import { peopleLoader } from './people';
import './genomes.css';

export const genomesFeature = feature({
  id: 'genomes',
  needs: ['cards', 'timeline'],
  picks: 'genome',
  // On or off with its layer, in historical time.
  watches: (state) => [state.layers, state.ma],
  mount(context) {
    const cellsOnGlobe = context.globe.addLayer(genomeLayer);
    const genomesLoad = loadOnce<AncientGenomes>({
      fetch: () => loadAncientGenomes(`${context.base}data/genomes/aadr.json`, context.fetchJson),
      what: 'the ancient genomes',
      context,
    });
    let loadOn = false;
    let said: string | null = null;
    let year = 0;
    // What was last drawn, so the moments of one year (many a second as time plays) cost nothing.
    let drawnFor = '';
    // While the years play, drawn a couple of times a second, not every frame (and not rested).
    const pace = travelPace(() => {
      context.refresh();
    });
    const peopleFor = peopleLoader(context.base, context.fetchJson);
    // Only the last region tapped opens, when its people have come.
    let picked = 0;

    return {
      show(state) {
        const on = state.layers.has('genomes') && state.ma === null;
        loadOn = on;
        const travelling = context.timeline.travelling();
        year = state.time.date.year;
        const key = `${String(on)}:${String(travelling)}:${genomesLoad.status()}:${String(year)}`;
        if (key === drawnFor) return;
        if (!on) {
          drawnFor = key;
          said = null;
          cellsOnGlobe.update(null);
          return;
        }
        const genomes = genomesLoad.value();
        if (genomes === null) {
          genomesLoad.want();
          said =
            genomesLoad.status() === 'failed'
              ? 'Could not load the ancient genomes.'
              : 'Loading the ancient genomes…';
          return;
        }
        if (!pace.due(travelling)) return;
        drawnFor = key;
        const near = genomesNear(genomes, year);
        said = genomesNote(near);
        cellsOnGlobe.update(near.cells);
      },
      pick(cell) {
        const data = genomesLoad.value();
        if (data === null) return;
        const at = year;
        const rows = cellRows(data, Number(cell), at);
        if (rows.length === 0) return;
        picked += 1;
        const ticket = picked;
        void peopleFor(data, rows).then((personAt) => {
          const card = genomeCellCard(data, Number(cell), at, personAt);
          if (ticket === picked && card !== null) context.cards.show(card);
        });
      },
      said: () => said,
      load: () => genomesLoad.report(loadOn),
    };
  },
});
