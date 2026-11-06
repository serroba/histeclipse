import { describe, expect, it } from 'vitest';

import { blankText, changesText } from './historyTrack';

describe('changesText', () => {
  it('says which states are new and which are gone by the year', () => {
    expect(changesText(-538, ['Achaemenid Empire'], ['Neo-Babylonian Empire'])).toBe(
      'By 539 BCE: new Achaemenid Empire · gone Neo-Babylonian Empire',
    );
    expect(changesText(1000, [], ['A'])).toBe('By 1000 CE: gone A');
  });

  it('names three of each, then counts the rest', () => {
    expect(changesText(1500, ['A', 'B', 'C', 'D', 'E'], [])).toBe(
      'By 1500 CE: new A, B, C and 2 more',
    );
  });

  it('has nothing to say when nothing changed', () => {
    expect(changesText(1500, [], [])).toBeNull();
  });
});

describe('blankText', () => {
  it('says why land may have no state, and where to see its people', () => {
    expect(blankText(true)).toBe(
      'Land with no state drawn was not empty: these sources map states, not every people; the faint shading is how people lived there (ArchaeoGLOBE).',
    );
    expect(blankText(false)).toContain('turn on Ways of life to see how people lived there.');
  });
});
