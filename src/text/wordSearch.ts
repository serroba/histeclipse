/**
 * Word search over the passages (#392): the words typed, matched to the passages that use them,
 * ranked by BM25, the last word matched as a prefix while it is still being typed. Names are
 * found exactly (Thales, Halys, Nineveh), which search by meaning is weak at (#393).
 *
 * Small enough to write rather than take a library for: the passages are a few hundred.
 */

import type { Passage } from './passages';

/** Words too common to tell passages apart. */
const STOP = new Set(
  'a an and are as at be by for from has have in is it its of on or that the this to was were which with'.split(
    ' ',
  ),
);

/** A word's plain form: lower case, without accents, its plural or possessive ending taken off. */
export function stem(word: string): string {
  const plain = word
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  if (plain.length > 4 && plain.endsWith('ies')) return `${plain.slice(0, -3)}y`;
  if (plain.length > 4 && /(?:ches|shes|sses|xes)$/.test(plain)) return plain.slice(0, -2);
  if (plain.length > 3 && plain.endsWith('s') && !/(?:ss|us|is)$/.test(plain)) {
    return plain.slice(0, -1);
  }
  return plain;
}

/** A text's words, as the index keeps them. */
export function words(text: string): string[] {
  return (text.replaceAll('’', "'").match(/[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu) ?? [])
    .map((word) => stem(word.replace(/'s$/i, '')))
    .filter((word) => !STOP.has(word));
}

/** A title counts for more than the text under it. */
const TITLE_WEIGHT = 3;
const K1 = 1.2;
const B = 0.75;

export interface WordIndex {
  readonly passages: readonly Passage[];
  /** Each word, the passages that use it and how often (titles counting thrice). */
  readonly postings: ReadonlyMap<string, ReadonlyMap<number, number>>;
  readonly lengths: readonly number[];
  readonly meanLength: number;
}

export function indexPassages(passages: readonly Passage[]): WordIndex {
  const postings = new Map<string, Map<number, number>>();
  const lengths = passages.map((passage, at) => {
    const counted: [string, number][] = [
      ...words(passage.title).map((word): [string, number] => [word, TITLE_WEIGHT]),
      ...words(`${passage.text} ${passage.cite ?? ''}`).map((word): [string, number] => [word, 1]),
    ];
    for (const [word, weight] of counted) {
      const posting = postings.get(word) ?? new Map<number, number>();
      posting.set(at, (posting.get(at) ?? 0) + weight);
      postings.set(word, posting);
    }
    return counted.reduce((sum, [, weight]) => sum + weight, 0);
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  return { passages, postings, lengths, meanLength: total / Math.max(1, lengths.length) };
}

export interface Hit {
  readonly passage: Passage;
  readonly score: number;
  /** The words of the passage the query matched, to pick a snippet by. */
  readonly matched: readonly string[];
}

/** The passages that best match the words typed, best first. */
export function searchWords(index: WordIndex, query: string, limit = 20): Hit[] {
  const asked = words(query);
  const last = asked.at(-1);
  // The last word may still be being typed: match it as the start of words too.
  const typing = last !== undefined && /[\p{L}\p{N}]$/u.test(query);
  const scores = new Map<number, number>();
  const matched = new Map<number, Set<string>>();
  const count = index.passages.length;
  asked.forEach((word, position) => {
    const terms =
      typing && position === asked.length - 1
        ? [...index.postings.keys()].filter((term) => term.startsWith(word))
        : index.postings.has(word)
          ? [word]
          : [];
    for (const term of terms) {
      const posting = index.postings.get(term) ?? new Map<number, number>();
      const idf = Math.log(1 + (count - posting.size + 0.5) / (posting.size + 0.5));
      for (const [at, frequency] of posting) {
        const length = index.lengths[at] ?? 0;
        const norm = frequency + K1 * (1 - B + (B * length) / index.meanLength);
        // A word typed in full outranks one it only begins.
        const exact = term === word ? 1 : 0.6;
        scores.set(at, (scores.get(at) ?? 0) + (exact * idf * frequency * (K1 + 1)) / norm);
        matched.set(at, (matched.get(at) ?? new Set<string>()).add(term));
      }
    }
  });
  return [...scores]
    .sort(([a, one], [b, other]) => other - one || a - b)
    .slice(0, limit)
    .flatMap(([at, score]) => {
      const passage = index.passages[at];
      return passage === undefined
        ? []
        : [{ passage, score, matched: [...(matched.get(at) ?? [])] }];
    });
}

/** The sentence of a passage where the query first matched, or its first, cut to `most`. */
export function snippet(passage: Passage, matched: readonly string[], most = 200): string {
  const sentences = passage.text.match(/[^.!?]+[.!?]*/g) ?? [passage.text];
  const hit =
    sentences.find((sentence) => words(sentence).some((word) => matched.includes(word))) ??
    sentences[0];
  const trimmed = hit.trim();
  return trimmed.length <= most ? trimmed : `${trimmed.slice(0, most - 1).trimEnd()}…`;
}
