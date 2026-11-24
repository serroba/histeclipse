/**
 * The great mass extinctions as a feature (#1190): their places loaded the first time the layer
 * is on, drawn in deep time near each extinction where the plates had them, a place's card when
 * tapped, and play easing near each as deep time runs past.
 */

import { loadExtinctionSites, type ExtinctionSites } from '../../data/extinctions';
import { loadOnce } from '../../state/loadOnce';
import { feature } from '../feature';
import { extinctionLayer } from './extinctionLayer';
import {
  extinctionCard,
  extinctionMarks,
  extinctionMoments,
  extinctionsOn,
  extinctionsText,
  pickedMark,
  type ExtinctionMark,
} from './view';

export const extinctionsFeature = feature({
  id: 'extinctions',
  needs: ['cards'],
  picks: 'extinction',
  watches: (state) => [state.layers, state.mode, state.ma, state.deepScale],
  mount(context) {
    const onGlobe = context.globe.addLayer(extinctionLayer);
    const load = loadOnce<ExtinctionSites>({
      fetch: () => loadExtinctionSites(`${context.base}data/extinctions.json`, context.fetchJson),
      what: 'the extinctions’ places',
      context,
    });
    let loadOn = false;
    let said: string | null = null;
    let marks: readonly ExtinctionMark[] = [];

    return {
      show(state) {
        const on = extinctionsOn(state);
        loadOn = on;
        if (!on || state.ma === null) {
          said = null;
          marks = [];
          onGlobe.update(null);
          return;
        }
        const data = load.value();
        if (data === null) {
          load.want();
          said =
            load.status() === 'failed'
              ? 'Could not load the extinctions’ places.'
              : 'Loading the extinctions’ places…';
          return;
        }
        marks = extinctionMarks(data, state.ma);
        onGlobe.update(marks);
        said = extinctionsText(marks);
      },
      pick(id) {
        const mark = pickedMark(marks, id);
        if (mark !== undefined) context.cards.show(extinctionCard(mark));
      },
      said: () => said,
      load: () => load.report(loadOn),
      // Play eases near each extinction while the layer is on (#1077).
      finds: (state) => (state.layers.has('extinctions') ? extinctionMoments() : []),
    };
  },
});
