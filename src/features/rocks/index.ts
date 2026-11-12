/**
 * Rocks at the surface as a part of the page (#446): in historical time with the layer on, the
 * rocks by age, and the rock at the place picked with a way to see the Earth as it was then.
 * Their file loads the first time the layer is turned on.
 */

import type { Globe } from '../../globe/scene';
import type { PartContext } from '../part';
import { RESTING } from '../feature';
import { rocksLayer } from '../../globe/historyPaintLayers';
import { type DeepScale, ICE_AGES_MA, type ViewState } from '../../state/viewState';
import { formatMa } from '../../time/format';
import {
  loadRocks,
  rockAt,
  rockText,
  rockUnits,
  type RockUnit,
  type Rocks,
} from '../../data/rocks';
import { errorMessage } from '../../util/errors';

/** What it asks of the rest of the page. */
export interface RocksContext extends PartContext {
  readonly globe: Pick<Globe, 'addLayer'>;
  /** Whether the reader is travelling through the years: today's maps rest then. */
  travelling(): boolean;
  /** Say it again in the Layers panel: what it says has changed. */
  refresh(): void;
  /** How far back the elevation maps reach, Ma. */
  oldest(): number;
  enterDeepTime(ma: number, scale: DeepScale): void;
}

export interface RocksPart {
  readonly show: (state: ViewState) => void;
  /** What the Layers panel says under the layer, if anything. */
  readonly said: () => string | null;
  /** The Layers panel's way to the rock's time, if a rock is picked. */
  readonly action: () => { readonly label: string; readonly run: () => void } | null;
  /** The rocks, once loaded. */
  readonly units: () => readonly RockUnit[] | null;
}

export function mountRocks(context: RocksContext): RocksPart {
  const { base, fetchJson, store } = context;
  const rocksOnGlobe = context.globe.addLayer(rocksLayer);
  // Rocks at the surface: their file loads the first time the layer is turned on.
  let rocks: readonly RockUnit[] | null = null;
  let rocksLoading: Promise<Rocks> | null = null;
  let rocksSaid: string | null = null;
  let rocksAction: { readonly label: string; readonly run: () => void } | null = null;

  /** In historical time with the layer on, the rocks by age, and the rock at the place picked. */
  function showRocks(state: ViewState): void {
    const on = state.layers.has('rocks') && state.ma === null;
    rocksAction = null;
    // Today's rocks say nothing of the year a trip shows: they rest with the markers.
    if (!on || context.travelling()) {
      rocksSaid = on ? RESTING : null;
      rocksOnGlobe.update(null);
      return;
    }
    if (rocks === null) {
      rocksSaid = 'Loading the rocks…';
      if (rocksLoading === null) {
        rocksLoading = loadRocks(`${base}data/rocks.json`, fetchJson);
        rocksLoading.then(
          (data) => {
            rocks = rockUnits(data);
            showRocks(store.get());
            context.refresh();
          },
          (error: unknown) => {
            rocksLoading = null;
            context.notify(`Could not load the rocks: ${errorMessage(error)}`);
          },
        );
      }
      return;
    }
    rocksOnGlobe.update(rocks);
    const rock = state.location === null ? null : rockAt(rocks, state.location);
    rocksSaid =
      state.location === null
        ? 'Pick a place on the globe to see its rock, and when it formed.'
        : rockText(rock);
    if (rock !== null) {
      // The middle of the rock's age range, on the span that reaches it.
      const ma = (rock.topMa + rock.bottomMa) / 2;
      const scale: DeepScale = ma <= ICE_AGES_MA ? 'ice' : ma <= context.oldest() ? 'all' : 'eons';
      rocksAction = {
        label: `See the Earth as it was then, ${formatMa(ma)}`,
        run: () => {
          context.enterDeepTime(ma, scale);
        },
      };
    }
  }

  return {
    show: showRocks,
    said: () => rocksSaid,
    action: () => rocksAction,
    units: () => rocks,
  };
}
