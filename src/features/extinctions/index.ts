/**
 * The great mass extinctions as a feature (#1190): their places loaded the first time the layer
 * is on, drawn in deep time near each extinction where the plates had them, a place's card when
 * tapped, and play easing near each as deep time runs past.
 */

import { loadExtinctionSites, type ExtinctionSites } from '../../data/extinctions';
import type { EarthPart } from '../../globe/earthParts';
import { loadOnce } from '../../state/loadOnce';
import { ANOXIC_SEAS_PART } from './anoxicSeasPart';
import { feature } from '../feature';
import { extinctionLayer } from './extinctionLayer';
import { ownTimeOf } from './ownTimeEvents';
import {
  extinctionCard,
  extinctionMarks,
  extinctionMoments,
  extinctionsOn,
  extinctionsPassed,
  extinctionsText,
  pickedMark,
  type ExtinctionMark,
} from './view';

/** The extinctions' parts of the Earth shader: the oxygen-poor seas (#1202). */
export const EXTINCTION_EARTH_PARTS: readonly EarthPart[] = [ANOXIC_SEAS_PART];

export const extinctionsFeature = feature({
  id: 'extinctions',
  needs: ['cards', 'timeline', 'ownTime'],
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
    let latest: number | null = null;
    // Where deep time was in the frame before, while it plays.
    let from: number | null = null;
    const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    /**
     * As deep time plays past an extinction that can be watched in its own time, it hands over to
     * its clock at Slow and offers it faster (#1191), once though Impacts reaches it too.
     */
    function handOver(data: ExtinctionSites, ma: number): void {
      const before = from;
      from = context.timeline.playing() ? ma : null;
      if (before === null || from === null || lessMotion.matches) return;
      for (const extinction of extinctionsPassed(before, ma)) {
        const event = ownTimeOf(data, extinction.id, ma);
        if (event !== null) context.ownTime.arrive(event, ma);
      }
    }

    return {
      show(state) {
        const on = extinctionsOn(state);
        loadOn = on;
        latest = state.ma;
        if (!on || state.ma === null) {
          from = null;
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
        handOver(data, state.ma);
      },
      pick(id) {
        const mark = pickedMark(marks, id);
        const data = load.value();
        if (mark === undefined || data === null || latest === null) return;
        const ma = latest;
        const event = ownTimeOf(data, mark.extinction.id, ma);
        const watch =
          event === null
            ? null
            : () => {
                context.ownTime.watch(event, ma);
              };
        context.cards.show(extinctionCard(mark, watch));
      },
      said: () => said,
      load: () => load.report(loadOn),
      // Play eases near each extinction while the layer is on (#1077).
      finds: (state) => (state.layers.has('extinctions') ? extinctionMoments() : []),
    };
  },
});
