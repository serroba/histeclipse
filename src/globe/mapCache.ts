/**
 * Deep time's maps, loaded once each and kept for when they are asked for again (#1045): the
 * maps shown, and the KEPT_MAPS asked for most recently besides. Each is a few megabytes of the
 * GPU's memory, and playing through 540 million years passes hundreds, so the rest are let go,
 * oldest asked for first, and loaded again (from the browser's cache) if asked for again.
 */

import type { Texture } from 'three';

const KEPT_MAPS = 24;

export interface MapCache {
  /** The map at `url`, loading it if it is not kept. */
  get(url: string): Promise<Texture>;
  /** Forget `url`, say after it failed, so the next ask tries again. */
  forget(url: string): void;
  /** What `who` shows now, never let go while shown; null when it shows nothing. */
  shows(who: string, urls: readonly string[] | null): void;
}

export function createMapCache(load: (url: string) => Promise<Texture>): MapCache {
  const kept = new Map<string, Promise<Texture>>();
  const shown = new Map<string, readonly string[]>();

  /** Let go of the maps asked for longest ago, beyond KEPT_MAPS, that nothing shows. */
  function letGo(): void {
    const showing = new Set([...shown.values()].flat());
    let over = kept.size - showing.size - KEPT_MAPS;
    for (const [url, pending] of kept) {
      if (over <= 0) return;
      if (showing.has(url)) continue;
      kept.delete(url);
      over -= 1;
      pending.then(
        (texture) => {
          texture.dispose();
        },
        () => undefined,
      );
    }
  }

  return {
    get(url) {
      const known = kept.get(url);
      // Asked for again: now the most recently asked, so the last to be let go.
      kept.delete(url);
      const pending = known ?? load(url);
      kept.set(url, pending);
      letGo();
      return pending;
    },
    forget(url) {
      kept.delete(url);
    },
    shows(who, urls) {
      if (urls === null) shown.delete(who);
      else shown.set(who, urls);
    },
  };
}
