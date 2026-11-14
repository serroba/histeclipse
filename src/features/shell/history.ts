/**
 * Back and Forward: show the view the address bar now describes, without writing it again, and
 * glide the globe's camera to the one it names (#581). A change of focus flies on its own.
 */

import { parseViewState } from '../../state/url';
import type { Store } from '../../state/store';
import type { UrlSync } from '../../state/urlSync';
import type { GlobeCamera, ViewState } from '../../state/viewState';

export function followHistory(options: {
  readonly window: Pick<Window, 'addEventListener'> & {
    readonly location: { readonly search: string };
  };
  readonly store: Pick<Store<ViewState>, 'get' | 'set'>;
  readonly sync: Pick<UrlSync, 'adopt'>;
  readonly globe: { setCamera(camera: GlobeCamera): void };
}): void {
  const { window, store, sync, globe } = options;
  window.addEventListener('popstate', () => {
    const before = store.get();
    const restored = parseViewState(window.location.search, new Date()).state;
    sync.adopt(restored);
    store.set(() => restored);
    if (restored.focus === before.focus) globe.setCamera(restored.camera);
  });
}
