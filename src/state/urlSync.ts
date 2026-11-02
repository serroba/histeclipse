/**
 * Keeps the address bar describing the current view, so it can be copied and shared at any
 * moment. Small changes (dragging the globe, scrubbing time) replace the current history entry,
 * so they don't flood the back button; a step a reader would want to go back from (picking an
 * eclipse, changing view, entering or leaving deep time) adds one, so Back returns to it.
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
  push(query: string): void;
}

export interface UrlSync {
  /**
   * Schedule writing `state`; within an interval only the latest state is written. A step a
   * reader would want to go back from is written at once, as a new history entry.
   */
  update(state: ViewState): void;
  /** Make the next update a step, with its own history entry, whatever it changes. */
  step(): void;
  /** Write any pending state now. */
  flush(): void;
  /** Take `state` as already in the address bar: after Back or Forward, nothing to write. */
  adopt(state: ViewState): void;
  dispose(): void;
}

/** Whether going from one view to another is a step worth its own place in history. */
export function isStep(before: ViewState, after: ViewState): boolean {
  return (
    before.mode !== after.mode ||
    before.view !== after.view ||
    before.focus !== after.focus ||
    before.selection !== after.selection ||
    (before.ma === null) !== (after.ma === null) ||
    before.deepScale !== after.deepScale ||
    before.years !== after.years ||
    before.seenIn !== after.seenIn ||
    !sameLayers(before.layers, after.layers)
  );
}

function sameLayers(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((layer) => b.has(layer));
}

export function createUrlSync(writer: UrlWriter, intervalMs = 500): UrlSync {
  let pending: ViewState | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let written = '';
  /** The latest state seen, to tell a step from a small change. */
  let latest: ViewState | null = null;
  /** Whether the next update was asked to be a step. */
  let stepNext = false;

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
      const before = latest;
      latest = state;
      const forced = stepNext;
      stepNext = false;
      if (before !== null && (forced || isStep(before, state))) {
        // Settle the entry being left, then start a new one for the step.
        flush();
        const query = serializeViewState(state);
        if (query !== written) {
          written = query;
          writer.push(query);
        }
        return;
      }
      pending = state;
      // Keep an existing timer: later updates just replace what it will write.
      timer ??= setTimeout(flush, intervalMs);
    },
    step() {
      stepNext = true;
    },
    flush,
    adopt(state) {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = null;
      latest = state;
      written = serializeViewState(state);
    },
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
    push(query) {
      history.pushState(null, '', `${location.pathname}?${query}${location.hash}`);
    },
  };
}
