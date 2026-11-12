/**
 * Search by meaning (#393): each passage's meaning as the pipeline embedded it (8 bits a part,
 * `public/data/passage-vectors.bin`), the query's as the model in the browser embeds it, and the
 * passages ranked by how alike they are. Then word search and meaning merged into one list by
 * reciprocal rank fusion, so a name found by its words and an idea found by its meaning both
 * rise.
 *
 * No vector database: a few hundred passages are compared in full in well under a millisecond.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../data/fetchJson';
import type { Passage } from './passages';
import type { Hit } from './wordSearch';

const VectorsIndexSchema = v.strictObject({
  schemaVersion: v.literal(1),
  model: v.string(),
  revision: v.string(),
  dims: v.pipe(v.number(), v.integer(), v.minValue(1)),
  scale: v.pipe(v.number(), v.minValue(1)),
  /** The SHA-256 of the passages file the vectors were made from. */
  passagesSha256: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
  ids: v.array(v.string()),
});
type VectorsIndex = v.InferOutput<typeof VectorsIndexSchema>;

export interface PassageVectors {
  readonly index: VectorsIndex;
  /** One row of `dims` parts a passage, in the index's order. */
  readonly rows: Int8Array;
}

export async function loadPassageVectors(url: string, fetchBinary: Fetch): Promise<PassageVectors> {
  const index = await getJson(fetchBinary, url.replace(/\.bin$/, '.json'), VectorsIndexSchema);
  const response = await fetchBinary(url);
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${String(response.status)}`);
  const rows = new Int8Array(await response.arrayBuffer());
  if (rows.length !== index.ids.length * index.dims) {
    throw new Error(
      `${url} has ${String(rows.length)} parts, not ${String(index.ids.length)} rows`,
    );
  }
  return { index, rows };
}

/** The passages most alike in meaning to a query's unit vector, best first. */
export function searchMeaning(
  vectors: PassageVectors,
  passages: readonly Passage[],
  query: Float32Array,
  limit = 20,
): Hit[] {
  const { index, rows } = vectors;
  const byId = new Map(passages.map((passage) => [passage.id, passage]));
  const scored: Hit[] = [];
  index.ids.forEach((id, row) => {
    const passage = byId.get(id);
    if (passage === undefined) return;
    let dot = 0;
    for (let part = 0; part < index.dims; part += 1) {
      dot += (rows[row * index.dims + part] ?? 0) * (query[part] ?? 0);
    }
    scored.push({ passage, score: dot / index.scale, matched: [] });
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** How far down a list still counts: reciprocal rank fusion's usual constant. */
const FUSION_K = 60;

/** Meaning results count only this near the best; bge's likenesses bunch together. */
const SPREAD = 0.08;
/** And never below this, however good the best. */
const FLOOR = 0.6;

/**
 * Word and meaning results as one list: each passage scored by 1 / (60 + its rank) in each list
 * it is in. A meaning result further than `SPREAD` below the best, or below `FLOOR`, is no match.
 */
export function fused(words: readonly Hit[], meaning: readonly Hit[], limit = 20): Hit[] {
  const merged = new Map<string, Hit>();
  const add = (hits: readonly Hit[]) => {
    hits.forEach((hit, rank) => {
      const before = merged.get(hit.passage.id);
      const score = (before?.score ?? 0) + 1 / (FUSION_K + rank + 1);
      merged.set(hit.passage.id, { ...hit, matched: before?.matched ?? hit.matched, score });
    });
  };
  const best = meaning[0]?.score ?? 0;
  add(words);
  add(meaning.filter((hit) => hit.score >= Math.max(FLOOR, best - SPREAD)));
  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
