/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import passagesData from '../../public/data/passages.json';
import vectorsIndex from '../../public/data/passage-vectors.json';
import embedding from '../../test-vectors/embedding.json';
import { fused, loadPassageVectors, searchMeaning } from './meaning';
import { loadPassages } from './passages';
import type { Hit } from './wordSearch';

const serve = (body: unknown) => () => Promise.resolve(new Response(JSON.stringify(body)));
const { passages } = await loadPassages('passages.json', serve(passagesData));
const bin = new Uint8Array(
  readFileSync(new URL('../../public/data/passage-vectors.bin', import.meta.url)),
);
const served =
  (index: unknown, rows: Uint8Array<ArrayBuffer>, ok = true) =>
  (url: string) =>
    Promise.resolve(
      url.endsWith('.json')
        ? new Response(JSON.stringify(index))
        : new Response(ok ? rows : null, { status: ok ? 200 : 404 }),
    );
const vectors = await loadPassageVectors('passage-vectors.bin', served(vectorsIndex, bin));
const query = Float32Array.from(embedding.query.vector);

describe('the passages’ meanings', () => {
  it('Given the passages file, Then the vectors were made from it, one row each, in its order', () => {
    const file = readFileSync(new URL('../../public/data/passages.json', import.meta.url));
    expect(
      vectors.index.passagesSha256,
      'the passages changed: run `uv run histeclipse-pipeline passage-vectors --out ../public/data/passage-vectors.bin` in data-pipeline',
    ).toBe(createHash('sha256').update(file).digest('hex'));
    expect(vectors.index.ids).toEqual(passages.map((passage) => passage.id));
  });

  it('Given the model’s vector for a question about an eclipse over Lydia in battle, Then Thales’s eclipse is first', () => {
    const [first, ...rest] = searchMeaning(vectors, passages, query, 5);
    expect(first?.passage.id).toBe('eclipse:thales-585-bce');
    expect(first?.score).toBeGreaterThan(0.7);
    expect(rest.every((hit) => hit.score <= (first?.score ?? 0))).toBe(true);
  });

  it('Given a passage’s own vector, Then it is most like itself', () => {
    const row = vectors.index.ids.indexOf('moon:europa');
    const own = Float32Array.from(
      vectors.rows.subarray(row * vectors.index.dims, (row + 1) * vectors.index.dims),
      (part) => part / vectors.index.scale,
    );
    expect(searchMeaning(vectors, passages, own, 1)[0]?.passage.id).toBe('moon:europa');
  });

  it('Given vectors for passages no longer there, Then they are passed over', () => {
    expect(searchMeaning(vectors, [], query)).toEqual([]);
  });

  it('Given a vectors file of the wrong length or missing, Then it is not read', async () => {
    await expect(
      loadPassageVectors('passage-vectors.bin', served(vectorsIndex, bin.slice(1))),
    ).rejects.toThrow(/parts/);
    await expect(
      loadPassageVectors('passage-vectors.bin', served(vectorsIndex, bin, false)),
    ).rejects.toThrow(/HTTP 404/);
  });
});

describe('words and meaning, merged', () => {
  const hit = (id: string, score = 1): Hit => ({
    passage: { id, kind: 'why', title: id, text: id, sources: [], anchors: [] },
    score,
    matched: [id],
  });

  it('Given a passage found both ways, Then it rises above those found one way', () => {
    const merged = fused([hit('why:a'), hit('why:b')], [hit('why:c', 0.8), hit('why:b', 0.76)]);
    expect(merged.map((h) => h.passage.id)).toEqual(['why:b', 'why:a', 'why:c']);
    // It keeps the words that matched, for its snippet.
    expect(merged[0]?.matched).toEqual(['why:b']);
  });

  it('Given meaning results too unlike the query, Then they are left out', () => {
    expect(fused([], [hit('why:far', 0.3)])).toEqual([]);
    // Nor those well below the best.
    expect(
      fused([], [hit('why:best', 0.75), hit('why:near', 0.7), hit('why:off', 0.65)]).map(
        (h) => h.passage.id,
      ),
    ).toEqual(['why:best', 'why:near']);
  });
});
