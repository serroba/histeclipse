/**
 * Back and Forward: show the view the address bar now describes, without writing it again, and
 * glide the globe's camera to the one it names (#581), landing there after a change of focus;
 * and, as the page goes, write the view it was left at.
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
  readonly sync: Pick<UrlSync, 'adopt' | 'flush'>;
  readonly globe: { setCamera(camera: GlobeCamera): void };
}): void {
  const { window, store, sync, globe } = options;
  window.addEventListener('popstate', () => {
    const restored = parseViewState(window.location.search, new Date()).state;
    sync.adopt(restored);
    // A change of focus starts its flight here; the camera then says where it lands.
    store.set(() => restored);
    globe.setCamera(restored.camera);
  });
  window.addEventListener('pagehide', () => {
    sync.flush();
  });
}
