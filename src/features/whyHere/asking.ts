/**
 * Asking "Why here?" (#474): while on, a tap on the globe opens what each layer has there. The
 * asking is kept here, not in the view, so a link never opens with it on.
 */

import type { Store } from '../../state/store';
import type { ViewState } from '../../state/viewState';
import type { ZoomRail } from '../../ui/zoomRail';

/** Where "Why here?" is offered: on Earth's globe, in the years. */
export function hereOffered(state: ViewState): boolean {
  return state.mode === 'globe' && state.focus === 'earth' && state.ma === null;
}

/** The sheet open once the asking is turned on or off: "Here" with it, and shut without it. */
export function whyAsked(asking: boolean, why: ViewState['why']): ViewState['why'] {
  if (asking) return 'here';
  return why === 'here' ? null : why;
}

export interface AskingContext {
  readonly store: Pick<Store<ViewState>, 'get' | 'set'>;
  readonly zoomRail: Pick<ZoomRail, 'setWhyHere'>;
  /** The page, marked while asking so the globe's cursor says so. */
  readonly root: { readonly classList: Pick<DOMTokenList, 'toggle'> };
}

export interface Asking {
  /** Whether a tap on the globe asks. */
  readonly on: () => boolean;
  /** The zoom rail's button: ask, or stop asking. */
  readonly toggle: () => void;
  /** The sheet changed by hand: closing it stops the asking too. */
  readonly sheetChanged: (why: ViewState['why']) => void;
  readonly render: (state: ViewState) => void;
}

export function createAsking(context: AskingContext): Asking {
  const { store } = context;
  let asking = false;
  return {
    on: () => asking,
    toggle: () => {
      asking = !asking;
      store.set((state) => ({ ...state, why: whyAsked(asking, state.why) }));
    },
    sheetChanged: (why) => {
      asking &&= why !== null;
    },
    render: (state) => {
      context.zoomRail.setWhyHere(hereOffered(state), asking);
      context.root.classList.toggle('is-asking-here', asking && state.ma === null);
    },
  };
}
