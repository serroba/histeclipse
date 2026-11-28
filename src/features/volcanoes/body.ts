/**
 * Volcanic eruptions near the year shown, the feature's body (#220): loaded the first time the
 * layer is on, as its front (`index.ts`) asks. A marker for each volcano that erupted near the year
 * shown (Smithsonian GVP), a tap opening its card, with its summary and photo once those load, the
 * first time a card opens.
 */

import {
  eruptionsNear,
  loadVolcanoDetails,
  loadVolcanoes,
  volcanoCard,
  volcanoesText,
  type VolcanoDetails,
  type VolcanoMark,
  type Volcanoes,
} from '../../data/volcanoes';
import { errorMessage } from '../../util/errors';
import { loadOnce } from '../../state/loadOnce';
import { RESTING, type FeatureContext, type FeatureInstance } from '../feature';
import type { VolcanoesNeeds } from './needs';
import { volcanoLayer } from './volcanoLayer';
import './volcanoes.css';

export function mountVolcanoes(context: FeatureContext<VolcanoesNeeds>): FeatureInstance {
  const marksOnGlobe = context.globe.addLayer(volcanoLayer);
  const volcanoesLoad = loadOnce<Volcanoes>({
    fetch: () => loadVolcanoes(`${context.base}data/volcanoes.json`, context.fetchJson),
    what: 'the eruptions',
    context,
  });
  let loadOn = false;
  let said: string | null = null;
  let marks: readonly VolcanoMark[] = [];
  let details: VolcanoDetails | null = null;
  let detailsLoading = false;
  let shown: VolcanoMark | null = null;
  // What was last drawn, so the moments of one year (many a second as time plays) cost nothing.
  let drawnFor = '';

  return {
    show(state) {
      const on = state.layers.has('volcanoes') && state.mode === 'globe' && state.ma === null;
      loadOn = on;
      const resting = context.timeline.travelling();
      const year = state.time.date.year;
      const key = `${String(on)}:${String(resting)}:${volcanoesLoad.status()}:${String(year)}`;
      if (key === drawnFor) return;
      drawnFor = key;
      if (!on || resting) {
        said = on ? RESTING : null;
        marks = [];
        marksOnGlobe.update(null);
        return;
      }
      const volcanoes = volcanoesLoad.value();
      if (volcanoes === null) {
        volcanoesLoad.want();
        said =
          volcanoesLoad.status() === 'failed'
            ? 'Could not load the eruptions.'
            : 'Loading the eruptions…';
        return;
      }
      marks = eruptionsNear(volcanoes, year);
      marksOnGlobe.update(marks);
      said = volcanoesText(marks, year);
    },
    pick(number) {
      const mark = marks.find((each) => String(each.volcano.number) === number);
      if (mark === undefined) return;
      shown = mark;
      context.cards.show(volcanoCard(mark, details));
      if (details !== null || detailsLoading) return;
      detailsLoading = true;
      loadVolcanoDetails(`${context.base}data/volcano-details.json`, context.fetchJson).then(
        (loaded) => {
          details = loaded;
          // Its summary and photo, if its card is still the one open.
          if (shown !== null && context.cards.open())
            context.cards.show(volcanoCard(shown, loaded));
        },
        (error: unknown) => {
          detailsLoading = false;
          context.notify(`Could not load the volcano’s summary: ${errorMessage(error)}`);
        },
      );
    },
    unpick() {
      shown = null;
    },
    said: () => said,
    load: () => volcanoesLoad.report(loadOn),
  };
}
