/**
 * The Layers panel as a part of the page (#451): the layers, one set for all of time, each
 * drawing on its own spans; the source of the borders; going to a span; and what each layer
 * says under it and offers, as the other parts tell it.
 */

import { layerWhy } from '../../state/whysOnScreen';
import type { DeepScale, Layer, ViewState } from '../../state/viewState';
import { awayFromEarth, roundMa, withLayer } from '../../state/viewState';
import { PRESENT_YEAR } from '../../time/present';
import { createLayersPanel } from './layersPanel';
import type { Span } from '../../ui/spanSwitch';
import type { PartContext } from '../part';

/** A button's label and what it does. */
interface LayerAction {
  readonly label: string;
  readonly run: () => void;
}

/** What the panel asks of the rest of the page. */
export interface LayersPanelContext extends PartContext {
  /** Deep time's ways to a span: a fresh start, into deep time at a moment, or another scale. */
  goToSpan(span: Span): void;
  enterDeepTime(ma: number, deepScale: DeepScale): void;
  setScale(deepScale: DeepScale): void;
  /** What each layer says under it, if anything, as the parts have it now. */
  said(): Iterable<readonly [Layer, string | null]>;
  /** What each layer offers, if anything. */
  actions(): Iterable<readonly [Layer, LayerAction | null]>;
  /** Whether the travel view is on. */
  travelling(): boolean;
}

export interface LayersPanelPart {
  readonly button: HTMLElement;
  readonly dialog: HTMLDialogElement;
  readonly show: (state: ViewState) => void;
}

/** The entries that have something, as the panel takes them. */
function present<T>(entries: Iterable<readonly [Layer, T | null]>): Map<Layer, T> {
  const kept = new Map<Layer, T>();
  for (const [layer, value] of entries) if (value !== null) kept.set(layer, value);
  return kept;
}

export function mountLayersPanel(context: LayersPanelContext): LayersPanelPart {
  const { store } = context;
  const panel = createLayersPanel(
    (layer, on) => {
      store.set((state) => ({ ...state, layers: withLayer(state.layers, layer, on) }));
    },
    (borders) => {
      store.set((state) => ({ ...state, borders }));
    },
    (span, ma) => {
      if (ma === undefined || span === 'years') context.goToSpan(span);
      else if (store.get().ma === null) context.enterDeepTime(ma, span);
      else {
        context.setScale(span);
        store.set((state) => ({ ...state, ma: roundMa(ma) }));
      }
    },
    (layer, label) => context.why(() => layerWhy(layer, store.get().borders), label),
  );
  return {
    button: panel.button,
    dialog: panel.dialog,
    show(state) {
      panel.render({
        layers: state.layers,
        borders: state.borders,
        year: state.time.date.year,
        present: PRESENT_YEAR,
        span: state.ma === null ? 'years' : state.deepScale,
        visible: state.mode === 'globe' && !awayFromEarth(state),
        said: present(context.said()),
        actions: present(context.actions()),
        travelling: context.travelling(),
      });
    },
  };
}
