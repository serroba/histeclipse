/**
 * The index of a second reconstruction's continents (#444), loaded once for the page: the
 * plates' layer outlines them from it, and deep time asks how far back they reach.
 */

import { loadPlateMasks, type PlateMaskIndex } from '../../data/plateMasks';
import type { Fetch } from '../../util/fetchJson';

export interface PlateMasks {
  /** The index, loaded once; a failed load is asked for again the next time. */
  ask(): Promise<PlateMaskIndex>;
  /** The index, once it has loaded. */
  loaded(): PlateMaskIndex | null;
  /** How far back the plates reach, Ma, once the index has loaded. */
  reach(): number | undefined;
}

export function createPlateMasks(base: string, fetchJson: Fetch): PlateMasks {
  let loading: Promise<PlateMaskIndex> | null = null;
  let index: PlateMaskIndex | null = null;
  return {
    ask() {
      if (loading === null) {
        const fresh = loadPlateMasks(`${base}data/plates/index.json`, fetchJson);
        loading = fresh;
        fresh.then(
          (loaded) => {
            index = loaded;
          },
          () => {
            loading = null;
          },
        );
      }
      return loading;
    },
    loaded: () => index,
    reach: () => index?.frames.at(-1)?.ma,
  };
}
