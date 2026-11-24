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
/** A story to play outranks the passages explaining how it is drawn (#842): it is what a reader
 * searching for it wants first. */
const STORY_WEIGHT = 1.5;
const K1 = 1.2;
const B = 0.75;

export interface WordIndex {
  readonly passages: readonly Passage[];
  /** Each word, the passages that use it and how often (titles counting thrice). */
  readonly postings: ReadonlyMap<string, ReadonlyMap<number, number>>;
  readonly lengths: readonly number[];
  readonly meanLength: number;
  /** Each passage's title's words. */
  readonly titles: readonly ReadonlySet<string>[];
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
  return {
    passages,
    postings,
    lengths,
    meanLength: total / Math.max(1, lengths.length),
    titles: passages.map((passage) => new Set(words(passage.title))),
  };
}

export interface Hit {
  readonly passage: Passage;
  readonly score: number;
  /** The words of the passage the query matched, to pick a snippet by. */
  readonly matched: readonly string[];
}

/** Up to how many words typed are taken for a name being looked up (#1210). */
const LOOKUP_WORDS = 3;

/**
 * How much a passage's score counts when a name is being looked up (#1210): by the share of the
 * words typed it holds, squared, so one holding them all outranks one holding one strongly; and
 * more where its title holds them, most where its title is little else: "Permian extinction"
 * is the end-Permian's, not one that mentions the Permian in passing, and "mass extinction" the
 * layer's, not each extinction's.
 */
function lookupWeight(
  index: WordIndex,
  asked: readonly string[],
  at: number,
  covered: ReadonlyMap<number, ReadonlySet<number>>,
  typing: boolean,
): number {
  const share = (covered.get(at)?.size ?? 0) / Math.max(1, asked.length);
  const title = index.titles[at] ?? new Set<string>();
  const named = asked.filter(
    (word, position) =>
      title.has(word) ||
      (typing && position === asked.length - 1 && [...title].some((t) => t.startsWith(word))),
  ).length;
  // A title that is little else than the words typed counts most; a story's title is its name
  // and a caption, by design (#842), so it counts in full.
  const story = index.passages[at]?.kind === 'story';
  const precision = story ? 1 : named / Math.max(1, title.size);
  const titled = 1 + (named / Math.max(1, asked.length)) * (0.5 + 0.5 * precision);
  return share * share * titled;
}

/** The passages that best match the words typed, best first. */
export function searchWords(index: WordIndex, query: string, limit = 20): Hit[] {
  const asked = words(query);
  const last = asked.at(-1);
  // The last word may still be being typed: match it as the start of words too, once it has
  // two characters. One alone (the "2" of "Voyager 2") would match every year from 2000 (#712).
  const typing = last !== undefined && last.length > 1 && /[\p{L}\p{N}]$/u.test(query);
  const scores = new Map<number, number>();
  const matched = new Map<number, Set<string>>();
  // Which of the words typed each passage matched, by position: one matching them all outranks
  // one matching a single word of them strongly (#1210).
  const covered = new Map<number, Set<number>>();
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
        covered.set(at, (covered.get(at) ?? new Set<number>()).add(position));
      }
    }
  });
  // A few words are a name, looked up: weigh how many of them a passage holds, and its title. A
  // longer question is in the reader's own words, left to plain ranking and search by meaning.
  const looking = asked.length <= LOOKUP_WORDS;
  for (const [at, score] of scores) {
    const story = index.passages[at]?.kind === 'story' ? STORY_WEIGHT : 1;
    scores.set(at, score * story * (looking ? lookupWeight(index, asked, at, covered, typing) : 1));
  }
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

/**
 * The sentence of a passage holding the most of the words matched, the first of those that tie,
 * or its first, cut to `most`: "The Great Dying.", not an earlier sentence with "dying" alone.
 */
export function snippet(passage: Passage, matched: readonly string[], most = 200): string {
  const sentences = passage.text.match(/[^.!?]+[.!?]*/g) ?? [passage.text];
  const held = (sentence: string) => new Set(words(sentence).filter((w) => matched.includes(w)));
  let hit = sentences[0];
  let best = 0;
  for (const sentence of sentences) {
    const count = held(sentence).size;
    if (count > best) {
      best = count;
      hit = sentence;
    }
  }
  const trimmed = hit.trim();
  return trimmed.length <= most ? trimmed : `${trimmed.slice(0, most - 1).trimEnd()}…`;
}
