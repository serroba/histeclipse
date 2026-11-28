/**
 * The great mass extinctions, the feature's body (#220): loaded the first time the layer is on in
 * deep time, as its front (`index.ts`) asks. Their places loaded and drawn near each extinction
 * where the plates had them, a place's card when tapped, play easing near each as deep time runs
 * past, and each extinction's own clock handed over to as play reaches it.
 */

import { loadExtinctionSites, type ExtinctionSites } from '../../data/extinctions';
import { loadOnce } from '../../state/loadOnce';
import type { FeatureContext, FeatureInstance } from '../feature';
import { extinctionLayer } from './extinctionLayer';
import { createFollow } from './follow';
import { ownTimeOf } from './ownTimeEvents';
import {
  extinctionCard,
  extinctionMarks,
  extinctionMoments,
  extinctionsOn,
  extinctionsPassed,
  extinctionsText,
  pickedMark,
  platesFact,
  type ExtinctionMark,
} from './view';

import type { ExtinctionsNeeds } from './needs';

export function mountExtinctions(context: FeatureContext<ExtinctionsNeeds>): FeatureInstance {
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
  // The globe turned to the extinction deep time is near (#1266).
  const follow = createFollow(context.strikes, () => context.ownTime.watching());
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
    context.cards.show(extinctionCard(mark, watch, platesFact(data, mark.site, mark.extinction)));
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
        follow.end();
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
      if (!lessMotion.matches) follow.at(marks);
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
}
