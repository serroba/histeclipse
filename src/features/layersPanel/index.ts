/**
 * The Layers panel as a part of the page (#451): the layers, one set for all of time, each
 * drawing on its own spans; the source of the borders; going to a span; and what each layer
 * says under it and offers, as the other parts tell it.
 */

import { layerWhy } from '../../state/whysOnScreen';
import type { DeepScale, Layer, ViewState } from '../../state/viewState';
import { awayFromEarth, layerTurned, roundMa } from '../../state/viewState';
import { PRESENT_YEAR } from '../../time/present';
import {
  absentSteps,
  activeLayers,
  spanShown,
  type GoTo,
  type LayerLoad,
} from '../../state/activeLayers';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import { LISTS } from '../../state/slices/sheets';
import { createActiveChips } from './activeChips';
import { createLayerRail } from './layerRail';
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
  /** Make the next change a step of its own in history: going to a layer's data. */
  step(): void;
  /** What each layer says under it, if anything, as the parts have it now. */
  said(): Iterable<readonly [Layer, string | null]>;
  /** What each layer offers, if anything. */
  actions(): Iterable<readonly [Layer, LayerAction | null]>;
  /** How each layer's load stands, where loading or failed (#751). */
  loads(): Iterable<readonly [Layer, LayerLoad | null]>;
}

export interface LayersPanelPart {
  readonly button: HTMLElement;
  readonly dialog: HTMLDialogElement;
  /** The layers on, as chips beside Layers (#728). */
  readonly chips: HTMLElement;
  /** The layers the span offers, for the zoom rail (#1156), and whether it has any now. */
  readonly rail: HTMLElement;
  readonly railOffered: () => boolean;
  /** Open the panel from `opener` (#752), which has the focus back when it closes. */
  readonly open: (opener: HTMLElement) => void;
  /** Go to where a layer's data is (#751), as its chip does. */
  readonly goTo: (to: GoTo) => void;
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
  /** Go to a span a layer draws on, at a moment of the layer's own if it has one. */
  const goTo = (span: Span, ma?: number): void => {
    if (ma === undefined || span === 'years') context.goToSpan(span);
    else if (store.get().ma === null) context.enterDeepTime(ma, span);
    else {
      context.setScale(span);
      store.set((state) => ({ ...state, ma: roundMa(ma) }));
    }
  };
  const chipActions = {
    onRemove: (layer: Layer) => {
      store.set((state) => layerTurned(state, layer, false));
    },
    // A layer's list (#850), where it has one.
    onList: (layer: Layer) => {
      const list = LISTS.find((each) => each === layer);
      if (list !== undefined) store.set((state) => ({ ...state, list }));
    },
    // Where its data is: a year in the years, or a span at a moment of its own (#751).
    onGoTo: (to: GoTo) => {
      if (to.year === undefined) {
        goTo(to.span, to.ma);
        return;
      }
      const year = astronomicalYear(to.year);
      context.step();
      // Outside its record, the bar shows the years it covers (#1078).
      store.set((state) => ({
        ...state,
        time: moveToYear(state.time, year),
        ...(to.years === undefined ? {} : { yearsWindow: to.years }),
      }));
    },
  };
  // Beside Layers on wide screens; on a phone, where the date panel has no room for them, at the
  // top of the Layers sheet, with their number on its button.
  const chips = createActiveChips(chipActions);
  const sheetChips = createActiveChips(chipActions);
  // A layer turned on or off, from the panel or the rail: time and the camera stay.
  const turn = (layer: Layer, on: boolean): void => {
    store.set((state) => layerTurned(state, layer, on));
  };
  const panel = createLayersPanel(
    turn,
    (borders) => {
      store.set((state) => ({ ...state, borders }));
    },
    goTo,
    (layer, label) => context.why(() => layerWhy(layer, store.get().borders), label),
  );
  // The layers the span offers, on the zoom rail (#1156): a tap turns one on or off.
  const rail = createLayerRail({ onLayer: turn, onAll: panel.open });
  sheetChips.root.classList.add('active-layers-sheet');
  panel.dialog.querySelector('header')?.after(sheetChips.root);
  return {
    button: panel.button,
    dialog: panel.dialog,
    chips: chips.root,
    rail: rail.root,
    railOffered: rail.offered,
    open: panel.open,
    goTo: chipActions.onGoTo,
    show(state) {
      const active = activeLayers(state, context.loads());
      chips.render(active);
      sheetChips.render(active);
      const visible = state.mode === 'globe' && !awayFromEarth(state);
      rail.render(spanShown(state), state.layers, active, visible);
      if (active.length === 0) delete panel.button.dataset['on'];
      else panel.button.dataset['on'] = String(active.length);
      panel.render({
        layers: state.layers,
        borders: state.borders,
        year: state.time.date.year,
        present: PRESENT_YEAR,
        span: state.ma === null ? 'years' : state.deepScale,
        visible,
        said: present(context.said()),
        actions: present(context.actions()),
        travelling: context.timeline.travelling(),
        absent: absentSteps(active, chipActions.onGoTo),
      });
    },
  };
}
