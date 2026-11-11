/**
 * Volcanic eruptions near the year shown, in historical time (Smithsonian GVP), on the feature
 * contract (#380): loaded with the layer, a marker for each volcano that erupted, a tap opening
 * its card, with its summary and photo once those load, the first time a card opens.
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
import { RESTING, type Feature } from '../feature';
import { volcanoLayer } from './volcanoLayer';
import './volcanoes.css';

export const volcanoesFeature: Feature = {
  id: 'volcanoes',
  picks: 'volcano',
  // On or off with its layer, and only on the globe, in historical time.
  watches: (state) => [state.layers, state.mode, state.ma],
  mount(context) {
    const marksOnGlobe = context.globe.addLayer(volcanoLayer);
    let volcanoes: Volcanoes | null = null;
    let loading = false;
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
        const resting = context.travelling();
        const year = state.time.date.year;
        const key = `${String(on)}:${String(resting)}:${String(volcanoes !== null)}:${String(year)}`;
        if (key === drawnFor) return;
        drawnFor = key;
        if (!on || resting) {
          said = on ? RESTING : null;
          marks = [];
          marksOnGlobe.update(null);
          return;
        }
        if (volcanoes === null) {
          said = 'Loading the eruptions…';
          if (loading) return;
          loading = true;
          loadVolcanoes(`${context.base}data/volcanoes.json`, context.fetchJson).then(
            (loaded) => {
              volcanoes = loaded;
              context.refresh();
            },
            (error: unknown) => {
              loading = false;
              drawnFor = '';
              context.notify(`Could not load the eruptions: ${errorMessage(error)}`);
            },
          );
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
        context.showCard(volcanoCard(mark, details));
        if (details !== null || detailsLoading) return;
        detailsLoading = true;
        loadVolcanoDetails(`${context.base}data/volcano-details.json`, context.fetchJson).then(
          (loaded) => {
            details = loaded;
            // Its summary and photo, if its card is still the one open.
            if (shown !== null && context.cardOpen()) context.showCard(volcanoCard(shown, loaded));
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
    };
  },
};
