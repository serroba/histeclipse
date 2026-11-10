/**
 * The model in the reader's browser (#393): bge-small-en-v1.5 run by onnxruntime-web on a query,
 * to compare with the passages the pipeline embedded with the same file. Everything is served from
 * this site (the model, its vocabulary, onnxruntime's WebAssembly), never from a third party, and
 * asked for only when the reader first searches by meaning. Nothing typed leaves the browser.
 *
 * Browser glue, covered by the end-to-end suite; the tokenizer is `wordpiece.ts`.
 */

import wasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';

import { loadPassageVectors, searchMeaning } from './meaning';
import { EMBEDDING_MODEL } from './model';
import type { Passage } from './passages';
import type { Hit } from './wordSearch';
import { readVocabulary, tokenIds } from './wordpiece';

export interface Embedder {
  /** A query's unit vector, after the model's instruction for queries. */
  embedQuery(text: string): Promise<Float32Array>;
}

export async function loadEmbedder(base: string): Promise<Embedder> {
  const folder = `${base}models/${EMBEDDING_MODEL.name}/`;
  const [ort, vocabulary] = await Promise.all([
    import('onnxruntime-web/wasm'),
    fetch(`${folder}vocab.txt`).then(async (response) => {
      if (!response.ok) throw new Error(`vocab.txt: HTTP ${String(response.status)}`);
      return readVocabulary(await response.text());
    }),
  ]);
  ort.env.wasm.wasmPaths = { wasm };
  // Threads need a cross-origin isolated page, which a static host cannot promise.
  ort.env.wasm.numThreads = 1;
  const session = await ort.InferenceSession.create(`${folder}onnx/model_quantized.onnx`);
  return {
    async embedQuery(text) {
      const ids = tokenIds(EMBEDDING_MODEL.query + text, vocabulary);
      const shape = [1, ids.length];
      const tensor = (values: (id: number) => number) =>
        new ort.Tensor(
          'int64',
          BigInt64Array.from(ids, (id) => BigInt(values(id))),
          shape,
        );
      const output = await session.run({
        input_ids: tensor((id) => id),
        attention_mask: tensor(() => 1),
        token_type_ids: tensor(() => 0),
      });
      const hidden = output['last_hidden_state'];
      if (hidden === undefined) throw new Error('the model gave no last_hidden_state');
      const dims = hidden.dims.at(-1) ?? 0;
      // The first token's state, [CLS], is bge's sentence vector; made unit length.
      const vector = Float32Array.from((hidden.data as Float32Array).subarray(0, dims));
      const length = Math.hypot(...vector);
      return vector.map((part) => part / (length || 1));
    },
  };
}

/**
 * Search by meaning (#393): the model, its runtime and the passages' vectors, asked for only once
 * the reader turns it on; then each query ranked against every passage.
 */
export async function loadMeaningSearch(
  base: string,
  passages: () => Promise<readonly Passage[]>,
): Promise<(query: string) => Promise<Hit[]>> {
  const [vectors, all, embedder] = await Promise.all([
    loadPassageVectors(`${base}data/passage-vectors.bin`, (url) => fetch(url)),
    passages(),
    loadEmbedder(base),
  ]);
  return async (query) => searchMeaning(vectors, all, await embedder.embedQuery(query));
}
