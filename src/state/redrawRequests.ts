/**
 * One typed way for a part of the page to ask another to redraw (#606), so parts stop naming
 * each other through closures over constants declared further down `app.ts`. A part is given
 * `ask('deepTime')`, a function it calls when its data has arrived; the part that draws deep
 * time `answer`s for it once mounted. Asked before anyone answers, nothing happens: there is
 * nothing on the page yet to redraw.
 */

import type { Store } from './store';
import type { ViewState } from './viewState';

/** The parts others ask to redraw. */
type RedrawTarget = 'moment' | 'deepTime' | 'layers' | 'years';

type Draw = (state: ViewState) => void;

export interface RedrawRequests {
  /** A function that asks `target` to redraw the view as it is now. */
  ask(target: RedrawTarget): () => void;
  /** A function that asks `target` to redraw a given view. */
  askWith(target: RedrawTarget): (state: ViewState) => void;
  /** What redraws `target`, once it is on the page. */
  answer(target: RedrawTarget, draw: Draw): void;
}

export function createRedrawRequests(store: Pick<Store<ViewState>, 'get'>): RedrawRequests {
  const answers = new Map<RedrawTarget, Draw>();
  const redraw = (target: RedrawTarget, state: ViewState): void => {
    answers.get(target)?.(state);
  };
  return {
    ask: (target) => () => {
      redraw(target, store.get());
    },
    askWith: (target) => (state) => {
      redraw(target, state);
    },
    answer: (target, draw) => {
      answers.set(target, draw);
    },
  };
}
