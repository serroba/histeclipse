/**
 * Impact craters and deposits as a part of the page (#474): loaded the first time the layer is
 * turned on, in either time; drawn where they lay at the moment shown; struck as deep time runs
 * past them; a crater's card, and a play of it.
 */

import {
  loadImpacts,
  impactsAt,
  impactsText,
  type Impacts,
  type ImpactsMode,
} from '../../data/impacts';
import { impactLayer } from './impactLayer';
import type { Globe } from '../../globe/scene';
import type { ViewState } from '../../state/viewState';
import type { DeepTimeView } from '../../ui/deepTimeBar';
import type { MarkerCardContent } from '../../ui/markerCard';
import { errorMessage } from '../../util/errors';
import { RESTING } from '../feature';
import type { PartContext } from '../part';
import {
  impactCard,
  impactPlay,
  impactsOn,
  impactsScale,
  pickedImpact,
  placeMaFor,
  sinceYear,
  strikesToPlay,
  struckList,
  type ImpactPlay,
} from './view';

export interface ImpactsContext extends PartContext {
  readonly globe: Pick<Globe, 'addLayer' | 'playImpact' | 'flyTo' | 'zoomTo'>;
  /** Where the latest strikes are written, for whoever needs to know one did. */
  readonly strikesOn: HTMLElement;
  showCard(card: MarkerCardContent): void;
  /** The oldest elevation map, in millions of years. */
  oldest(): number;
  /** Whether deep time is playing. */
  playing(): boolean;
  /** Whether the reader is travelling through the years: the layer rests meanwhile. */
  travelling(): boolean;
  /** The craters have loaded in deep time: draw it again. */
  redrawDeep(state: ViewState): void;
  /** The craters have loaded in the years: the Layers panel says so. */
  refreshLayers(state: ViewState): void;
}

export interface ImpactsPart {
  /** Draw the craters for the view, and say how the layer stands in deep time's bar. */
  readonly show: (state: ViewState) => DeepTimeView['impacts'];
  /** What the Layers panel says under the layer. */
  readonly said: () => string | null;
  /** In deep time: each impact around its time, or every one that had struck by then. */
  readonly setMode: (mode: ImpactsMode) => void;
  /** The craters, loaded once. */
  readonly load: () => Promise<Impacts>;
  /** A marker tapped: whether it was a crater, and if so, its card. */
  readonly pick: (key: string) => boolean;
  /** What the Layers panel offers under the layer: the craters' paths through time, in 3D. */
  readonly action: () => { readonly label: string; readonly run: () => void };
}

export function mountImpacts(context: ImpactsContext): ImpactsPart {
  const { store, globe } = context;
  const onGlobe = globe.addLayer(impactLayer);
  const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let impacts: Impacts | null = null;
  let loading: Promise<Impacts> | null = null;
  let said: string | null = null;
  let mode: ImpactsMode = 'around';
  // Where deep time was in the frame before, while it plays.
  let strikeFrom: number | null = null;

  /** The craters, loaded once: by the layer, or by the paths' sheet, whichever asks first. */
  function load(): Promise<Impacts> {
    if (impacts !== null) return Promise.resolve(impacts);
    if (loading !== null) return loading;
    const fresh = loadImpacts(`${context.base}data/impacts.json`, context.fetchJson);
    loading = fresh;
    fresh.then(
      (loaded) => {
        impacts = loaded;
      },
      () => {
        // Asked again, it is fetched again.
        loading = null;
      },
    );
    return fresh;
  }

  // Whether the layer waits on the craters, to draw once they arrive.
  let waiting = false;
  function loadThenDraw(): void {
    if (waiting) return;
    waiting = true;
    load().then(
      () => {
        waiting = false;
        const now = store.get();
        if (now.ma !== null) {
          context.redrawDeep(now);
          return;
        }
        show(now);
        context.refreshLayers(now);
      },
      (error: unknown) => {
        waiting = false;
        context.notify(`Could not load the impact craters: ${errorMessage(error)}`);
      },
    );
  }

  function show(state: ViewState): DeepTimeView['impacts'] {
    const { ma } = state;
    const scale = impactsScale(state, context.oldest());
    const on = impactsOn(state, scale);
    if (!on || (context.travelling() && ma === null)) {
      said = on ? RESTING : null;
      onGlobe.update(null);
      return { on: false };
    }
    if (impacts === null) {
      said = 'Loading the impact craters…';
      loadThenDraw();
      return { on: true, text: null, mode };
    }
    if (ma === null) {
      const marks = impactsAt(impacts, sinceYear(state), true);
      onGlobe.update(marks);
      said = impactsText(impacts, marks, null);
      return { on: true, text: said, mode };
    }
    const placeMa = placeMaFor(scale, ma);
    const marks = impactsAt(impacts, ma, false, placeMa, mode);
    onGlobe.update(marks);
    strikeAsItPasses(state, impacts, ma, placeMa);
    said = null;
    return { on: true, text: impactsText(impacts, marks, ma, mode), mode };
  }

  // As deep time plays, each crater strikes when the time passes it (#242, #314): several at
  // once, only on the side of the globe in view, and never for a reader who asks for less motion.
  function strikeAsItPasses(state: ViewState, data: Impacts, ma: number, placeMa: number): void {
    const from = strikeFrom;
    const playing = context.playing();
    strikeFrom = playing ? ma : null;
    if (from === null || !playing || lessMotion.matches || state.focus !== 'earth') return;
    for (const { impact, place } of strikesToPlay(data, from, ma, placeMa, state.camera.target)) {
      context.strikesOn.dataset['strikes'] = struckList(
        context.strikesOn.dataset['strikes'],
        impact.name,
      );
      globe.playImpact(impactPlay(impact.name, place, impact.diameterKm ?? 0));
    }
  }

  /** Play an impact at its place: turn the globe to it, come in close, and let it fall. */
  function play(spec: ImpactPlay): void {
    if (store.get().focus !== 'earth') {
      store.set((state) => ({ ...state, focus: 'earth', view: 'free' }));
    }
    globe.flyTo(spec.place);
    globe.zoomTo(Math.min(store.get().camera.distance, 2.2));
    // Once the globe has turned to it.
    window.setTimeout(() => {
      globe.playImpact(spec);
    }, 1000);
  }

  return {
    show,
    said: () => said,
    setMode: (next) => {
      mode = next;
    },
    load,
    pick: (key) => {
      const impact = pickedImpact(impacts, key);
      if (impacts === null || impact === undefined) return false;
      context.showCard(impactCard(impacts, impact, store.get().ma ?? 0, play));
      return true;
    },
    action: () => ({
      label: 'Their paths through time, in 3D',
      run: () => {
        store.set((state) => ({ ...state, craters: 'all' }));
      },
    }),
  };
}
