/**
 * Search by meaning (#393), made ready: the model, its runtime and the passages' vectors, asked
 * for only once the reader turns it on. The model's code is imported only then, so it stays out
 * of the page's first download.
 *
 * Browser glue, covered by the end-to-end suite; the ranking is `meaning.ts`.
 */

import { loadPassageVectors, searchMeaning } from './meaning';
import type { Passage } from './passages';
import type { Hit } from './wordSearch';

export async function loadMeaningSearch(
  base: string,
  passages: () => Promise<readonly Passage[]>,
): Promise<(query: string) => Promise<Hit[]>> {
  const [{ loadEmbedder }, vectors, all] = await Promise.all([
    import('./embedder'),
    loadPassageVectors(`${base}data/passage-vectors.bin`, (url) => fetch(url)),
    passages(),
  ]);
  const embedder = await loadEmbedder(base);
  return async (query) => searchMeaning(vectors, all, await embedder.embedQuery(query));
}
