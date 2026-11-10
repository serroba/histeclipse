import { describe, expect, it } from 'vitest';

import vocab from '../../public/models/bge-small-en-v1.5/vocab.txt?raw';
import vectors from '../../test-vectors/embedding.json';
import { normalized, pieces, preTokenized, readVocabulary, tokenIds } from './wordpiece';

const vocabulary = readVocabulary(vocab);

describe('the WordPiece tokenizer', () => {
  it('Given the reference tokenizer’s splits of awkward texts, Then ours are the same', () => {
    for (const { text, ids } of vectors.tokens)
      expect(tokenIds(text, vocabulary), text).toEqual(ids);
  });

  it('Given text with accents, controls, odd spaces and ideographs, Then it is cleaned as BERT cleans it', () => {
    expect(normalized('Ganymède\u0000​ 日食')).toBe('ganymede  日  食 ');
    expect(preTokenized("it's (i.74)")).toEqual(['it', "'", 's', '(', 'i', '.', '74', ')']);
    // Every block of ideographs is set apart, and every group of ASCII marks split off.
    const ideographs = [
      '\u3400',
      '\u{20000}',
      '\u{2a700}',
      '\u{2b740}',
      '\u{2b820}',
      '\uf900',
      '\u{2f800}',
    ];
    expect(normalized(ideographs.join(''))).toBe(
      ideographs.map((c) => ` ${c.normalize('NFD')} `).join(''),
    );
    expect(preTokenized('a@b[c{d~e—f')).toEqual([
      'a',
      '@',
      'b',
      '[',
      'c',
      '{',
      'd',
      '~',
      'e',
      '—',
      'f',
    ]);
  });

  it('Given a word too long or with no pieces, Then it is unknown', () => {
    expect(pieces('a'.repeat(101), vocabulary)).toEqual(['[UNK]']);
    expect(pieces('☃', vocabulary)).toEqual(['[UNK]']);
    expect(tokenIds('☃', vocabulary)).toEqual([101, 100, 102]);
  });

  it('Given a text longer than the model reads, Then it is cut to 512 tokens', () => {
    const ids = tokenIds('moon '.repeat(600), vocabulary);
    expect(ids).toHaveLength(512);
    expect(ids.at(-1)).toBe(102);
  });

  it('Given a vocabulary without the special pieces, Then ids fall back to 0', () => {
    expect(tokenIds('x', readVocabulary('x'))).toEqual([0, 0, 0]);
  });
});
