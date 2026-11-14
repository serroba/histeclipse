/**
 * Opening a view from a link's worth of it (#726): a search anchor's or a destination's, laid
 * over the reader's view as `anchorQuery` says, as a step that Back undoes.
 */

import { parseViewState, serializeViewState } from '../state/url';
import type { Store } from '../state/store';
import type { ViewState } from '../state/viewState';
import { anchorQuery } from '../text/anchors';
import type { Anchor } from '../text/passages';

export function anchorOpener(options: {
  readonly store: Pick<Store<ViewState>, 'get' | 'set'>;
  /** Deep time's player: stopped, or it would carry the view on from where it was. */
  readonly deepTime: { stopPlay(): void };
  /** The link's writer, once there is one: the change is a step of its own in history. */
  readonly sync: () => { step(): void };
}): (anchor: Anchor) => void {
  const { store, deepTime, sync } = options;
  return (anchor) => {
    const next = parseViewState(anchorQuery(anchor, serializeViewState(store.get())), new Date());
    deepTime.stopPlay();
    sync().step();
    store.set(() => next.state);
  };
}
