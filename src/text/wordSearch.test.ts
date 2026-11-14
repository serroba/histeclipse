import { describe, expect, it } from 'vitest';

import data from '../../public/data/passages.json';
import { loadPassages, type Passage } from './passages';
import { indexPassages, searchWords, snippet, stem, words } from './wordSearch';

const serve = (body: unknown) => () => Promise.resolve(new Response(JSON.stringify(body)));
const { passages } = await loadPassages('passages.json', serve(data));
const index = indexPassages(passages);
const first = (query: string) => searchWords(index, query)[0]?.passage.id;

describe('word search', () => {
  it('Given words in their plural, possessive or accented forms, Then they are kept plain', () => {
    expect(stem('Eclipses')).toBe('eclipse');
    expect(stem('stories')).toBe('story');
    expect(stem('Ganymède')).toBe('ganymede');
    expect(stem('Halys')).toBe('haly');
    expect(stem('Ugarit')).toBe('ugarit');
    expect(stem('glass')).toBe('glass');
    expect(stem('Io')).toBe('io');
    expect(words('The Moon’s shadow, and the Sun’s')).toEqual(['moon', 'shadow', 'sun']);
  });

  it('Given a place named in one record, Then that record comes first', () => {
    expect(first('Ugarit')).toBe('eclipse:ugarit-1223-bce');
    expect(first('ugarit tablet')).toBe('eclipse:ugarit-1223-bce');
  });

  it('Given a word still being typed, Then the words it begins are matched', () => {
    expect(first('Ugar')).toBe('eclipse:ugarit-1223-bce');
    // Once a space follows, the word is whole and must match as it stands.
    expect(searchWords(index, 'Ugar ')).toEqual([]);
  });

  it('Given a mission by its name and number, Then it comes first, the number not taken for a year (#712)', () => {
    expect(first('Voyager 2')).toBe('mission:d00574');
    expect(first('Voyager 1')).toBe('mission:d00578');
    expect(first('Apollo 11')).toMatch(/^(mission|landing):/);
    expect(
      searchWords(index, 'Apollo 11').some(({ passage }) => passage.id === 'mission:d00273'),
    ).toBe(true);
  });

  it('Given a moon’s name, Then its own story outranks passages that mention it', () => {
    expect(first('Enceladus')).toBe('moon:enceladus');
    expect(first('volcanoes Io')).toBe('moon:io');
  });

  it('Given nothing, or only common words, Then nothing is found', () => {
    expect(searchWords(index, '')).toEqual([]);
    expect(searchWords(index, 'the of and ')).toEqual([]);
  });

  it('Given many matches, Then no more than asked for are given, best first', () => {
    const hits = searchWords(index, 'Moon', 5);
    expect(hits).toHaveLength(5);
    const scores = hits.map((hit) => hit.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('Given a hit, Then its snippet is the sentence that matched, cut when long', () => {
    const [hit] = searchWords(index, 'Stickney');
    if (hit === undefined) throw new Error('Stickney not found');
    expect(hit.passage.id).toBe('moon:phobos');
    expect(snippet(hit.passage, hit.matched)).toContain('Stickney');
    const long: Passage = {
      id: 'why:long',
      kind: 'why',
      title: 'Long',
      text: `${'word '.repeat(80)}end.`,
      sources: [],
      anchors: [],
    };
    const cut = snippet(long, ['absent'], 40);
    expect(cut).toHaveLength(40);
    expect(cut.endsWith('…')).toBe(true);
    expect(snippet({ ...long, text: '' }, [])).toBe('');
  });
});
