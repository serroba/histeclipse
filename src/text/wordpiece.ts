/**
 * BERT's WordPiece tokenizer, as bge-small-en-v1.5 uses it (#393): the reader's query split into
 * the model's vocabulary exactly as the reference tokenizer splits it, which the pipeline's test
 * vectors check (`test-vectors/embedding.json`).
 *
 * Text is cleaned (control characters dropped, white space made spaces), Chinese characters set
 * apart, accents stripped and letters lowered; split at spaces and at each punctuation mark; and
 * each word split greedily into the longest pieces the vocabulary has, those after the first
 * marked "##". A word it cannot split, or over 100 characters, is [UNK].
 */

const UNKNOWN = '[UNK]';
const START = '[CLS]';
const END = '[SEP]';
/** The model reads 512 tokens at most, [CLS] and [SEP] among them. */
const MOST_TOKENS = 512;
const LONGEST_WORD = 100;

/** A vocabulary: each piece's id, its line in vocab.txt. */
export type Vocabulary = ReadonlyMap<string, number>;

export function readVocabulary(text: string): Vocabulary {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return new Map(lines.map((piece, id) => [piece, id]));
}

/** Chinese, Japanese and Korean ideographs, as BERT sets them apart. */
function ideograph(code: number): boolean {
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x20000 && code <= 0x2a6df) ||
    (code >= 0x2a700 && code <= 0x2b73f) ||
    (code >= 0x2b740 && code <= 0x2b81f) ||
    (code >= 0x2b820 && code <= 0x2ceaf) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0x2f800 && code <= 0x2fa1f)
  );
}

/** BERT's punctuation: ASCII's non-letters and non-digits, and Unicode's punctuation. */
function punctuation(char: string, code: number): boolean {
  if ((code >= 33 && code <= 47) || (code >= 58 && code <= 64)) return true;
  if ((code >= 91 && code <= 96) || (code >= 123 && code <= 126)) return true;
  return /\p{P}/u.test(char);
}

/** Text as BERT's normalizer leaves it: clean, ideographs apart, unaccented, lower case. */
export function normalized(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (char === '\t' || char === '\n' || char === '\r' || /\s/u.test(char)) out += ' ';
    else if (code === 0 || code === 0xfffd || /[\p{Cc}\p{Cf}]/u.test(char)) continue;
    else if (ideograph(code)) out += ` ${char} `;
    else out += char;
  }
  return out
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase();
}

/** Words as BERT splits them: at white space, and each punctuation mark a word of its own. */
export function preTokenized(text: string): string[] {
  const words: string[] = [];
  for (const chunk of text.split(' ')) {
    let word = '';
    for (const char of chunk) {
      if (punctuation(char, char.codePointAt(0) ?? 0)) {
        if (word !== '') words.push(word);
        words.push(char);
        word = '';
      } else {
        word += char;
      }
    }
    if (word !== '') words.push(word);
  }
  return words;
}

/** A word in the vocabulary's pieces: the longest first, those after it marked "##". */
export function pieces(word: string, vocabulary: Vocabulary): string[] {
  const chars = Array.from(word);
  if (chars.length > LONGEST_WORD) return [UNKNOWN];
  const out: string[] = [];
  let start = 0;
  while (start < chars.length) {
    let end = chars.length;
    let found: string | null = null;
    while (start < end) {
      const piece = (start > 0 ? '##' : '') + chars.slice(start, end).join('');
      if (vocabulary.has(piece)) {
        found = piece;
        break;
      }
      end -= 1;
    }
    if (found === null) return [UNKNOWN];
    out.push(found);
    start = end;
  }
  return out;
}

/** A text's token ids, [CLS] first and [SEP] last, cut to what the model reads. */
export function tokenIds(text: string, vocabulary: Vocabulary): number[] {
  const id = (piece: string): number => vocabulary.get(piece) ?? vocabulary.get(UNKNOWN) ?? 0;
  const ids = preTokenized(normalized(text))
    .flatMap((word) => pieces(word, vocabulary))
    .map(id)
    .slice(0, MOST_TOKENS - 2);
  return [id(START), ...ids, id(END)];
}
