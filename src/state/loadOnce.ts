/**
 * A layer's data, fetched once when first wanted (#762): what its chip says while it loads or
 * after it failed, with Try again. A failed load waits for Try again; it is not fetched again at
 * every moment shown, as time plays.
 */

import type { LayerLoad } from './activeLayers';
import { errorMessage } from '../util/errors';

type LoadStatus = 'idle' | 'loading' | 'failed' | 'loaded';

export interface LoadOnce<T> {
  /** The data, once loaded. */
  value(): T | null;
  status(): LoadStatus;
  /** Fetch it, unless it is loaded, loading, or failed and waiting for Try again. */
  want(): void;
  /** For the feature's `load()`: how it stands while `on` and not loaded, else null. */
  report(on: boolean): LayerLoad | null;
}

export interface LoadOnceOptions<T> {
  readonly fetch: () => Promise<T>;
  /** What is loaded, as the reader is told it failed: "the ozone record". */
  readonly what: string;
  /**
   * Told when it failed; asked to refresh when the load ends, either way, and on Try again, so
   * the moment and the chips say so.
   */
  readonly context: { notify(message: string): void; refresh(): void };
}

export function loadOnce<T>(options: LoadOnceOptions<T>): LoadOnce<T> {
  let value: T | null = null;
  let status: LoadStatus = 'idle';

  function want(): void {
    if (status !== 'idle') return;
    status = 'loading';
    options.fetch().then(
      (loaded) => {
        value = loaded;
        status = 'loaded';
        options.context.refresh();
      },
      (error: unknown) => {
        status = 'failed';
        options.context.notify(`Could not load ${options.what}: ${errorMessage(error)}`);
        options.context.refresh();
      },
    );
  }

  function retry(): void {
    if (status !== 'failed') return;
    status = 'idle';
    want();
    options.context.refresh();
  }

  return {
    value: () => value,
    status: () => status,
    want,
    report(on) {
      if (!on) return null;
      if (status === 'loading') return { state: 'loading' };
      if (status === 'failed') return { state: 'failed', retry };
      return null;
    },
  };
}
