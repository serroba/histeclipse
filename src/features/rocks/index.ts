/**
 * Rocks at the surface as a feature (#380, #909): in historical time with the layer on, the
 * rocks by age, and the rock at the place picked with a way to see the Earth as it was then.
 * Their file loads the first time the layer is turned on.
 */

import { loadOnce } from '../../state/loadOnce';
import { feature, RESTING, type LayerAction } from '../feature';
import { rocksLayer } from '../../globe/historyPaintLayers';
import { type DeepScale, type GeoPoint, ICE_AGES_MA, type ViewState } from '../../state/viewState';
import { formatMa } from '../../time/format';
import { loadRocks, rockAt, rockText, rockUnits, type RockUnit } from '../../data/rocks';
import { rockFact } from './here';

export const rocksFeature = feature({
  id: 'rocks',
  needs: ['timeline', 'deepTime'],
  watches: (state) => [state.layers, state.ma, state.location],
  mount(context) {
    const { base, fetchJson } = context;
    const rocksOnGlobe = context.globe.addLayer(rocksLayer);
    const load = loadOnce<readonly RockUnit[]>({
      fetch: () => loadRocks(`${base}data/rocks.json`, fetchJson).then(rockUnits),
      what: 'the rocks',
      context,
    });
    let loadOn = false;
    let rocksSaid: string | null = null;
    let rocksAction: LayerAction | null = null;
    // The rock last looked up, and where: finding it among the units is slow.
    let found: { readonly place: GeoPoint; readonly rock: RockUnit | null } | null = null;

    /** The rock at a place, looked up once a place. */
    function rockHere(units: readonly RockUnit[], place: GeoPoint): RockUnit | null {
      if (found?.place !== place) found = { place, rock: rockAt(units, place) };
      return found.rock;
    }

    /** In historical time with the layer on, the rocks by age, and the rock at the place picked. */
    function showRocks(state: ViewState): void {
      const on = state.layers.has('rocks') && state.ma === null;
      loadOn = on;
      rocksAction = null;
      // Today's rocks say nothing of the year a trip shows: they rest with the markers.
      if (!on || context.timeline.travelling()) {
        rocksSaid = on ? RESTING : null;
        rocksOnGlobe.update(null);
        return;
      }
      const rocks = load.value();
      if (rocks === null) {
        load.want();
        rocksSaid = load.status() === 'failed' ? 'Could not load the rocks.' : 'Loading the rocks…';
        return;
      }
      rocksOnGlobe.update(rocks);
      const rock = state.location === null ? null : rockHere(rocks, state.location);
      rocksSaid =
        state.location === null
          ? 'Pick a place on the globe to see its rock, and when it formed.'
          : rockText(rock);
      if (rock !== null) {
        // The middle of the rock's age range, on the span that reaches it.
        const ma = (rock.topMa + rock.bottomMa) / 2;
        const scale: DeepScale =
          ma <= ICE_AGES_MA ? 'ice' : ma <= context.timeline.oldest() ? 'all' : 'eons';
        rocksAction = {
          label: `See the Earth as it was then, ${formatMa(ma)}`,
          run: () => {
            context.deepTime.enter(ma, scale);
          },
        };
      }
    }

    return {
      show: showRocks,
      said: () => rocksSaid,
      load: () => load.report(loadOn),
      action: () => rocksAction,
      here(state) {
        if (state.location === null || state.ma !== null) return null;
        const rocks = load.value();
        if (!state.layers.has('rocks') || rocks === null) return null;
        return rockFact(rockHere(rocks, state.location));
      },
    };
  },
});
