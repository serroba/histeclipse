/**
 * Keeps the address bar describing the current view, so it can be copied and shared at any
 * moment. Uses `replaceState` (not `pushState`) so exploring doesn't flood the back button,
 * and debounces writes so dragging the globe doesn't rewrite the URL every frame.
 */

import { serializeViewState } from './url';
import type { ViewState } from './viewState';

export interface UrlWriter {
  replace(query: string): void;
}

export interface UrlSync {
  /** Schedule writing `state`; only the last state within the delay is written. */
  update(state: ViewState): void;
  /** Write any pending state now. */
  flush(): void;
  dispose(): void;
}

export function createUrlSync(writer: UrlWriter, delayMs = 250): UrlSync {
  let pending: ViewState | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let written = '';

  function flush(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (pending === null) return;
    const query = serializeViewState(pending);
    pending = null;
    if (query !== written) {
      written = query;
      writer.replace(query);
    }
  }

  return {
    update(state) {
      pending = state;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}

/** Writes to the real address bar. */
export function browserUrlWriter(location: Location, history: History): UrlWriter {
  return {
    replace(query) {
      history.replaceState(history.state, '', `${location.pathname}?${query}${location.hash}`);
    },
  };
}
