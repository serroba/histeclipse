import { describe, expect, it } from 'vitest';

import { blankText, changesText, earthText } from './historyTrack';

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

describe('earthText', () => {
  const series = (label: string) => ({ id: label, label }) as never;
  it('gives the sea level against today, by its source', () => {
    expect(
      earthText({ seaLevel: -35.4, series: series('Bintanja & van de Wal 2008'), instead: null }),
    ).toBe(
      'Sea level 35 m below today’s (Bintanja & van de Wal 2008); shelf it left bare is tinted sand. White: ice of the year where today has none (PaleoMIST, Gowan et al. 2021); today’s glaciers are in the photo.',
    );
    expect(earthText({ seaLevel: 0.2, series: series('A'), instead: null })).toContain(
      'Sea level about today’s (A);',
    );
    expect(earthText({ seaLevel: 2, series: series('A'), instead: series('B') })).toContain(
      'Sea level 2 m above today’s (A, as B does not reach);',
    );
  });
});
