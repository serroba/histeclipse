/**
 * Keeps the address bar describing the current view, so it can be copied and shared at any
 * moment. Uses `replaceState` (not `pushState`) so exploring doesn't flood the back button.
 *
 * Writes are throttled, not debounced: the URL updates at most once per `intervalMs` while the
 * view keeps changing, and the final state is always written. A debounce would starve during
 * long continuous motion (a globe gliding after a flick on a slow device fires changes every
 * frame for many seconds). The interval also keeps us under Safari's limit of 100
 * `replaceState` calls per 30 seconds.
 */

import { serializeViewState } from './url';
import type { ViewState } from './viewState';

export interface UrlWriter {
  replace(query: string): void;
}

export interface UrlSync {
  /** Schedule writing `state`; within an interval only the latest state is written. */
  update(state: ViewState): void;
  /** Write any pending state now. */
  flush(): void;
  dispose(): void;
}

export function createUrlSync(writer: UrlWriter, intervalMs = 500): UrlSync {
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
      // Keep an existing timer: later updates just replace what it will write.
      timer ??= setTimeout(flush, intervalMs);
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
