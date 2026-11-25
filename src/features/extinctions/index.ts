/**
 * The great mass extinctions as a feature (#1190): their places loaded the first time the layer
 * is on, drawn in deep time near each extinction where the plates had them, a place's card when
 * tapped, and play easing near each as deep time runs past.
 */

import { loadExtinctionSites, type ExtinctionSites } from '../../data/extinctions';
import type { EarthPart } from '../../globe/earthParts';
import { loadOnce } from '../../state/loadOnce';
import { ANOXIC_SEAS_PART } from './anoxicSeasPart';
import { LAVA_FLOWS_PART } from './lavaFlowsPart';
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

// The extinctions as passages for search (#1210).
export { extinctionPassages } from './passages';

/**
 * The extinctions' parts of the Earth shader: the flood lavas (#1212), the oxygen-poor seas
 * (#1202).
 */
export const EXTINCTION_EARTH_PARTS: readonly EarthPart[] = [LAVA_FLOWS_PART, ANOXIC_SEAS_PART];

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
    // A place a passage opened before its mark was drawn (#1233): its card opens once it is.
    let pending: string | null = null;

    /** A place's card, with its own time to watch where it has one: whether it opened. */
    function openCard(id: string): boolean {
      const mark = pickedMark(marks, id);
      const data = load.value();
      if (mark === undefined || data === null || latest === null) return false;
      const ma = latest;
      const event = ownTimeOf(data, mark.extinction.id, ma);
      const watch =
        event === null
          ? null
          : () => {
              context.ownTime.watch(event, ma);
            };
      context.cards.show(extinctionCard(mark, watch));
      return true;
    }

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
          pending = null;
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
        if (pending !== null && openCard(pending)) pending = null;
      },
      pick(id) {
        pending = openCard(id) ? null : id;
      },
      unpick() {
        pending = null;
      },
      said: () => said,
      load: () => load.report(loadOn),
      // Play eases near each extinction while the layer is on (#1077).
      finds: (state) => (state.layers.has('extinctions') ? extinctionMoments() : []),
    };
  },
});
