/**
 * Opening a view from a link's worth of it (#726): a search anchor's or a destination's, laid
 * over the reader's view as `anchorQuery` says, or the reader's link changed, as fitting a
 * subject's time does (#729); each a step that Back undoes.
 */

import { parseViewState, serializeViewState } from '../state/url';
import type { Store } from '../state/store';
import type { GlobeCamera, ViewState } from '../state/viewState';
import { anchorQuery } from '../text/anchors';
import type { Anchor } from '../text/passages';

/** Ways to open a view: an anchor's, or any change to the reader's link. */
export interface ViewOpener {
  readonly anchor: (anchor: Anchor) => void;
  /** Open the link `change` makes of the reader's. */
  readonly query: (change: (current: string) => string) => void;
}

export function viewOpener(options: {
  readonly store: Pick<Store<ViewState>, 'get' | 'set'>;
  /** Deep time's player: stopped, or it would carry the view on from where it was. */
  readonly deepTime: { stopPlay(): void };
  /** The link's writer, once there is one: the change is a step of its own in history. */
  readonly sync: () => { step(): void };
  /**
   * The globe's camera, which follows the store only when told (#942): a view that names a
   * camera of its own glides there, as Back and Forward do.
   */
  readonly globe: { setCamera(camera: GlobeCamera): void };
}): ViewOpener {
  const { store, deepTime, sync, globe } = options;
  const query = (change: (current: string) => string): void => {
    const before = store.get().camera;
    const next = parseViewState(change(serializeViewState(store.get())), new Date());
    deepTime.stopPlay();
    sync().step();
    store.set(() => next.state);
    if (!sameCamera(before, next.state.camera)) globe.setCamera(next.state.camera);
  };
  return {
    anchor: (anchor) => {
      query((current) => anchorQuery(anchor, current));
    },
    query,
  };
}

function sameCamera(a: GlobeCamera, b: GlobeCamera): boolean {
  return (
    a.distance === b.distance &&
    a.target.latitude === b.target.latitude &&
    a.target.longitude === b.target.longitude
  );
}
